//! Persistent key store for one device.
//!
//! Every record is kept as bytes, so the whole store can be exported to JSON and
//! restored later. The browser encrypts that JSON before saving it, so private
//! keys never sit unencrypted in storage. The stores are separate parts, because
//! the protocol needs the session and identity stores as two separate borrows.

use async_trait::async_trait;
use libsignal_protocol::{
    Direction, GenericSignedPreKey, IdentityChange, IdentityKey, IdentityKeyPair, IdentityKeyStore,
    KyberPreKeyId, KyberPreKeyRecord, KyberPreKeyStore, PreKeyId, PreKeyRecord, PreKeyStore,
    ProtocolAddress, PublicKey, SenderKeyRecord, SenderKeyStore, SessionRecord, SessionStore,
    SignalProtocolError, SignedPreKeyId, SignedPreKeyRecord, SignedPreKeyStore,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

fn address_key(address: &ProtocolAddress) -> String {
    format!("{}:{}", address.name(), address.device_id())
}

#[derive(Serialize, Deserialize, Default)]
pub struct IdentityPart {
    key_pair: Vec<u8>,
    registration_id: u32,
    identities: HashMap<String, Vec<u8>>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct SessionPart {
    sessions: HashMap<String, Vec<u8>>,
}

/// The key directory stores prekey ids as signed 32-bit integers.
pub const MAX_PREKEY_ID: u32 = i32::MAX as u32;

#[derive(Serialize, Deserialize, Default)]
pub struct PreKeyPart {
    pre_keys: HashMap<u32, Vec<u8>>,
    /// Highest one-time prekey id ever allocated. Ids are never reused, even after a
    /// prekey is consumed, so a new key cannot take an id the server already handed out.
    #[serde(default)]
    high_water: u32,
}

#[derive(Serialize, Deserialize, Default)]
pub struct SignedPreKeyPart {
    signed_pre_keys: HashMap<u32, Vec<u8>>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct KyberPreKeyPart {
    kyber_pre_keys: HashMap<u32, Vec<u8>>,
}

/// Group (sender key) state.
///
/// `records` holds sender key records, both our own and those received from other
/// members, keyed by sender address and distribution id. `own` maps each group id to
/// the distribution id of our current sender key for that group. `received` maps
/// "sender|group" to the distribution ids that sender has announced for the group, so
/// a message is only accepted under a key that was sent for that group.
#[derive(Serialize, Deserialize, Default)]
pub struct SenderKeyPart {
    records: HashMap<String, Vec<u8>>,
    own: HashMap<String, String>,
    received: HashMap<String, Vec<String>>,
}

fn sender_key_record_key(address: &ProtocolAddress, distribution_id: Uuid) -> String {
    format!("{}|{}", address_key(address), distribution_id)
}

fn received_key(sender: &str, group_id: &str) -> String {
    format!("{sender}|{group_id}")
}

impl SenderKeyPart {
    /// Our current distribution id for a group, if we have created one.
    pub fn own_distribution(&self, group_id: &str) -> Option<Uuid> {
        self.own.get(group_id).and_then(|id| Uuid::parse_str(id).ok())
    }

    pub fn set_own_distribution(&mut self, group_id: &str, distribution_id: Uuid) {
        self.own.insert(group_id.to_string(), distribution_id.to_string());
    }

    /// Forgets our sender key for a group, so the next one is a fresh chain.
    pub fn drop_own_distribution(&mut self, own_address: &ProtocolAddress, group_id: &str) {
        if let Some(distribution_id) = self.own_distribution(group_id) {
            self.records.remove(&sender_key_record_key(own_address, distribution_id));
        }
        self.own.remove(group_id);
    }

    pub fn remember_received(&mut self, sender: &str, group_id: &str, distribution_id: Uuid) {
        let ids = self.received.entry(received_key(sender, group_id)).or_default();
        let id = distribution_id.to_string();
        if !ids.contains(&id) {
            ids.push(id);
        }
    }

    pub fn has_received(&self, sender: &str, group_id: &str, distribution_id: Uuid) -> bool {
        self.received
            .get(&received_key(sender, group_id))
            .is_some_and(|ids| ids.contains(&distribution_id.to_string()))
    }
}

/// All of one device's keys and sessions.
#[derive(Serialize, Deserialize, Default)]
pub struct DeviceStore {
    pub identity: IdentityPart,
    pub sessions: SessionPart,
    pub pre_keys: PreKeyPart,
    pub signed_pre_keys: SignedPreKeyPart,
    pub kyber_pre_keys: KyberPreKeyPart,
    /// Absent in exports made before group support, so those still restore.
    #[serde(default)]
    pub sender_keys: SenderKeyPart,
}

impl DeviceStore {
    pub fn new(key_pair: &IdentityKeyPair, registration_id: u32) -> Self {
        DeviceStore {
            identity: IdentityPart {
                key_pair: key_pair.serialize().to_vec(),
                registration_id,
                identities: HashMap::new(),
            },
            ..Default::default()
        }
    }

    /// Exports the whole store as JSON, for encrypted storage in the browser.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string(self)
    }

    /// Restores a store exported with `to_json`.
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

#[async_trait(?Send)]
impl IdentityKeyStore for IdentityPart {
    async fn get_identity_key_pair(&self) -> Result<IdentityKeyPair, SignalProtocolError> {
        IdentityKeyPair::try_from(&self.key_pair[..])
    }

    async fn get_local_registration_id(&self) -> Result<u32, SignalProtocolError> {
        Ok(self.registration_id)
    }

    async fn save_identity(
        &mut self,
        address: &ProtocolAddress,
        identity: &IdentityKey,
    ) -> Result<IdentityChange, SignalProtocolError> {
        let bytes = identity.serialize().to_vec();
        match self.identities.insert(address_key(address), bytes.clone()) {
            None => Ok(IdentityChange::NewOrUnchanged),
            Some(previous) if previous == bytes => Ok(IdentityChange::NewOrUnchanged),
            Some(_) => Ok(IdentityChange::ReplacedExisting),
        }
    }

    async fn is_trusted_identity(
        &self,
        address: &ProtocolAddress,
        identity: &IdentityKey,
        _direction: Direction,
    ) -> Result<bool, SignalProtocolError> {
        // Trust on first use: an unknown identity is accepted, a changed one is not.
        Ok(match self.identities.get(&address_key(address)) {
            None => true,
            Some(known) => known[..] == identity.serialize()[..],
        })
    }

    async fn get_identity(
        &self,
        address: &ProtocolAddress,
    ) -> Result<Option<IdentityKey>, SignalProtocolError> {
        match self.identities.get(&address_key(address)) {
            None => Ok(None),
            Some(bytes) => Ok(Some(IdentityKey::decode(bytes)?)),
        }
    }
}

#[async_trait(?Send)]
impl SessionStore for SessionPart {
    async fn load_session(
        &self,
        address: &ProtocolAddress,
    ) -> Result<Option<SessionRecord>, SignalProtocolError> {
        match self.sessions.get(&address_key(address)) {
            None => Ok(None),
            Some(bytes) => Ok(Some(SessionRecord::deserialize(bytes)?)),
        }
    }

    async fn store_session(
        &mut self,
        address: &ProtocolAddress,
        record: &SessionRecord,
    ) -> Result<(), SignalProtocolError> {
        self.sessions.insert(address_key(address), record.serialize()?);
        Ok(())
    }
}

impl PreKeyPart {
    /// The lowest one-time prekey id not yet used up. This is the one a bundle advertises.
    pub fn lowest_id(&self) -> Option<u32> {
        self.pre_keys.keys().copied().min()
    }

    /// Reserves `count` new consecutive ids, all above every id used so far.
    pub fn allocate_ids(&mut self, count: u32) -> Result<Vec<u32>, String> {
        let highest = self.pre_keys.keys().copied().max().unwrap_or(0).max(self.high_water);
        let last = u64::from(highest) + u64::from(count);
        if last > u64::from(MAX_PREKEY_ID) {
            return Err("one-time prekey ids are exhausted".to_string());
        }
        if count > 0 {
            self.high_water = last as u32;
        }
        Ok((highest + 1..=highest + count).collect())
    }
}

#[async_trait(?Send)]
impl PreKeyStore for PreKeyPart {
    async fn get_pre_key(&self, prekey_id: PreKeyId) -> Result<PreKeyRecord, SignalProtocolError> {
        let bytes = self
            .pre_keys
            .get(&u32::from(prekey_id))
            .ok_or(SignalProtocolError::InvalidPreKeyId)?;
        PreKeyRecord::deserialize(bytes)
    }

    async fn save_pre_key(
        &mut self,
        prekey_id: PreKeyId,
        record: &PreKeyRecord,
    ) -> Result<(), SignalProtocolError> {
        self.pre_keys.insert(u32::from(prekey_id), record.serialize()?);
        Ok(())
    }

    async fn remove_pre_key(&mut self, prekey_id: PreKeyId) -> Result<(), SignalProtocolError> {
        // A one-time prekey is used up once a session has consumed it.
        self.pre_keys.remove(&u32::from(prekey_id));
        Ok(())
    }
}

#[async_trait(?Send)]
impl SignedPreKeyStore for SignedPreKeyPart {
    async fn get_signed_pre_key(
        &self,
        signed_prekey_id: SignedPreKeyId,
    ) -> Result<SignedPreKeyRecord, SignalProtocolError> {
        let bytes = self
            .signed_pre_keys
            .get(&u32::from(signed_prekey_id))
            .ok_or(SignalProtocolError::InvalidSignedPreKeyId)?;
        SignedPreKeyRecord::deserialize(bytes)
    }

    async fn save_signed_pre_key(
        &mut self,
        signed_prekey_id: SignedPreKeyId,
        record: &SignedPreKeyRecord,
    ) -> Result<(), SignalProtocolError> {
        self.signed_pre_keys.insert(u32::from(signed_prekey_id), record.serialize()?);
        Ok(())
    }
}

#[async_trait(?Send)]
impl KyberPreKeyStore for KyberPreKeyPart {
    async fn get_kyber_pre_key(
        &self,
        kyber_prekey_id: KyberPreKeyId,
    ) -> Result<KyberPreKeyRecord, SignalProtocolError> {
        let bytes = self
            .kyber_pre_keys
            .get(&u32::from(kyber_prekey_id))
            .ok_or(SignalProtocolError::InvalidKyberPreKeyId)?;
        KyberPreKeyRecord::deserialize(bytes)
    }

    async fn save_kyber_pre_key(
        &mut self,
        kyber_prekey_id: KyberPreKeyId,
        record: &KyberPreKeyRecord,
    ) -> Result<(), SignalProtocolError> {
        self.kyber_pre_keys.insert(u32::from(kyber_prekey_id), record.serialize()?);
        Ok(())
    }

    async fn mark_kyber_pre_key_used(
        &mut self,
        _kyber_prekey_id: KyberPreKeyId,
        _ec_prekey_id: SignedPreKeyId,
        _base_key: &PublicKey,
    ) -> Result<(), SignalProtocolError> {
        // The Kyber prekey is kept as the last-resort key, so it is not removed here.
        Ok(())
    }
}

#[async_trait(?Send)]
impl SenderKeyStore for SenderKeyPart {
    async fn store_sender_key(
        &mut self,
        sender: &ProtocolAddress,
        distribution_id: Uuid,
        record: &SenderKeyRecord,
    ) -> Result<(), SignalProtocolError> {
        self.records.insert(sender_key_record_key(sender, distribution_id), record.serialize()?);
        Ok(())
    }

    async fn load_sender_key(
        &mut self,
        sender: &ProtocolAddress,
        distribution_id: Uuid,
    ) -> Result<Option<SenderKeyRecord>, SignalProtocolError> {
        match self.records.get(&sender_key_record_key(sender, distribution_id)) {
            None => Ok(None),
            Some(bytes) => Ok(Some(SenderKeyRecord::deserialize(bytes)?)),
        }
    }
}
