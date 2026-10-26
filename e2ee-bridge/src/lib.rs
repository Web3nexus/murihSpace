//! Signal protocol bridge for MuriSpace end-to-end encryption.
//!
//! Each device creates its keys here, publishes only the public parts, and
//! encrypts or decrypts on the device. The server never sees keys or plaintext.
//! The same code runs in the browser (WebAssembly) and in native tests.

mod store;

/// C ABI for Dart (Android and iOS). Only built with the `ffi` feature.
#[cfg(feature = "ffi")]
pub mod ffi;

use base64::prelude::*;
use futures::executor::block_on;
use libsignal_protocol::{
    create_sender_key_distribution_message, group_decrypt, group_encrypt, kem, message_decrypt,
    message_encrypt, process_prekey_bundle, process_sender_key_distribution_message,
    CiphertextMessage, DeviceId, GenericSignedPreKey, IdentityKey, IdentityKeyPair,
    IdentityKeyStore, KeyPair, KyberPreKeyId, KyberPreKeyRecord, KyberPreKeyStore, PreKeyBundle,
    PreKeyId, PreKeyRecord, PreKeySignalMessage, PreKeyStore, ProtocolAddress, PublicKey,
    SenderKeyDistributionMessage, SenderKeyMessage, SignalMessage, SignalProtocolError,
    SignedPreKeyId, SignedPreKeyRecord, SignedPreKeyStore, Timestamp,
};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::time::SystemTime;
use store::DeviceStore;
use uuid::Uuid;
use wasm_bindgen::prelude::*;

/// The first byte of every ciphertext says which Signal message type follows.
const TAG_PREKEY: u8 = 3;
const TAG_WHISPER: u8 = 2;

/// Version byte of a sender key distribution envelope (see `encode_distribution`).
const DISTRIBUTION_ENVELOPE_VERSION: u8 = 1;

/// Public part of a device's keys. This is what the server stores and hands out.
#[derive(Serialize, Deserialize)]
pub struct PublicBundle {
    pub registration_id: u32,
    pub device_id: u32,
    pub identity_key: String,
    pub prekey_id: u32,
    pub prekey_public: String,
    pub signed_prekey_id: u32,
    pub signed_prekey_public: String,
    pub signed_prekey_signature: String,
    pub kyber_prekey_id: u32,
    pub kyber_prekey_public: String,
    pub kyber_prekey_signature: String,
}

fn js_err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn decode(value: &str) -> Result<Vec<u8>, String> {
    BASE64_STANDARD.decode(value).map_err(js_err)
}

fn address(name: &str) -> Result<ProtocolAddress, String> {
    Ok(ProtocolAddress::new(name.to_string(), DeviceId::new(1).map_err(js_err)?))
}

/// Current time. WebAssembly has no system clock in std, so the browser's clock is used there.
fn now() -> SystemTime {
    #[cfg(target_arch = "wasm32")]
    {
        SystemTime::UNIX_EPOCH + std::time::Duration::from_millis(js_sys::Date::now() as u64)
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        SystemTime::now()
    }
}

fn now_millis() -> u64 {
    now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// A distribution envelope is what gets encrypted to each member over a 1:1 session:
/// `version | u16 group id length | group id | sender key distribution message`.
/// The group id travels inside the encrypted envelope, so the receiver learns which
/// group the key is for without the server seeing it.
fn encode_distribution(group_id: &str, skdm: &[u8]) -> Result<Vec<u8>, String> {
    let id = group_id.as_bytes();
    let len = u16::try_from(id.len()).map_err(js_err)?;
    let mut out = Vec::with_capacity(3 + id.len() + skdm.len());
    out.push(DISTRIBUTION_ENVELOPE_VERSION);
    out.extend_from_slice(&len.to_be_bytes());
    out.extend_from_slice(id);
    out.extend_from_slice(skdm);
    Ok(out)
}

fn decode_distribution(data: &[u8]) -> Result<(String, &[u8]), String> {
    if data.len() < 3 || data[0] != DISTRIBUTION_ENVELOPE_VERSION {
        return Err(js_err("not a sender key distribution"));
    }
    let len = u16::from_be_bytes([data[1], data[2]]) as usize;
    let rest = &data[3..];
    if rest.len() < len {
        return Err(js_err("truncated sender key distribution"));
    }
    let group_id = std::str::from_utf8(&rest[..len]).map_err(js_err)?.to_string();
    Ok((group_id, &rest[len..]))
}

/// One device's keys and sessions. Private keys stay inside this object, and are
/// exported only as JSON that the browser encrypts before storing.
#[wasm_bindgen]
pub struct Device {
    store: DeviceStore,
    name: String,
    prekey_count: u32,
}

#[wasm_bindgen]
impl Device {
    /// Creates a device with fresh identity, signed, Kyber and one-time prekeys.
    #[wasm_bindgen(constructor)]
    pub fn new(name: String, registration_id: u32, prekey_count: u32) -> Result<Device, String> {
        let mut rng = rand::rng();
        let identity = IdentityKeyPair::generate(&mut rng);
        let mut store = DeviceStore::new(&identity, registration_id);

        block_on(async {
            let signed_id = SignedPreKeyId::from(1u32);
            let signed_pair = KeyPair::generate(&mut rng);
            let signed_sig = identity
                .private_key()
                .calculate_signature(&signed_pair.public_key.serialize(), &mut rng)?;
            let now = Timestamp::from_epoch_millis(now_millis());
            store
                .signed_pre_keys
                .save_signed_pre_key(
                    signed_id,
                    &SignedPreKeyRecord::new(signed_id, now, &signed_pair, &signed_sig),
                )
                .await?;

            // Built here rather than with KyberPreKeyRecord::generate, which reads the system clock.
            let kyber_id = KyberPreKeyId::from(1u32);
            let kyber_pair = kem::KeyPair::generate(kem::KeyType::Kyber1024, &mut rng);
            let kyber_sig = identity
                .private_key()
                .calculate_signature(&kyber_pair.public_key.serialize(), &mut rng)?;
            let kyber = KyberPreKeyRecord::new(kyber_id, now, &kyber_pair, &kyber_sig);
            store.kyber_pre_keys.save_kyber_pre_key(kyber_id, &kyber).await?;

            for id in 1..=prekey_count {
                let pre_key_id = PreKeyId::from(id);
                let pair = KeyPair::generate(&mut rng);
                store
                    .pre_keys
                    .save_pre_key(pre_key_id, &PreKeyRecord::new(pre_key_id, &pair))
                    .await?;
            }
            Ok::<(), SignalProtocolError>(())
        })
        .map_err(js_err)?;

        Ok(Device { store, name, prekey_count })
    }

    /// Restores a device from the JSON produced by `export`.
    pub fn restore(name: String, state_json: String) -> Result<Device, String> {
        let store = DeviceStore::from_json(&state_json).map_err(js_err)?;
        Ok(Device { store, name, prekey_count: 0 })
    }

    /// Everything this device must keep: keys and sessions, as JSON. The caller
    /// must encrypt this before storing it anywhere.
    pub fn export(&self) -> Result<String, String> {
        self.store.to_json().map_err(js_err)
    }

    /// The public keys to upload to the key directory, as JSON.
    #[wasm_bindgen(js_name = publicBundle)]
    pub fn public_bundle(&self) -> Result<String, String> {
        let identity = block_on(self.store.identity.get_identity_key_pair()).map_err(js_err)?;
        let signed = block_on(self.store.signed_pre_keys.get_signed_pre_key(SignedPreKeyId::from(1u32)))
            .map_err(js_err)?;
        let kyber = block_on(self.store.kyber_pre_keys.get_kyber_pre_key(KyberPreKeyId::from(1u32)))
            .map_err(js_err)?;
        // Advertise the first one-time prekey not yet used up. A prekey is removed once a
        // session consumes it, so a second peer gets a live key rather than a dead one.
        let prekey_id = self
            .store
            .pre_keys
            .lowest_id()
            .ok_or_else(|| js_err("no one-time prekeys left"))?;
        let pre_key = block_on(self.store.pre_keys.get_pre_key(PreKeyId::from(prekey_id))).map_err(js_err)?;

        let bundle = PublicBundle {
            registration_id: block_on(self.store.identity.get_local_registration_id()).map_err(js_err)?,
            device_id: 1,
            identity_key: BASE64_STANDARD.encode(identity.identity_key().serialize()),
            prekey_id,
            prekey_public: BASE64_STANDARD.encode(pre_key.public_key().map_err(js_err)?.serialize()),
            signed_prekey_id: 1,
            signed_prekey_public: BASE64_STANDARD.encode(signed.public_key().map_err(js_err)?.serialize()),
            signed_prekey_signature: BASE64_STANDARD.encode(signed.signature().map_err(js_err)?),
            kyber_prekey_id: 1,
            kyber_prekey_public: BASE64_STANDARD.encode(kyber.public_key().map_err(js_err)?.serialize()),
            kyber_prekey_signature: BASE64_STANDARD.encode(kyber.signature().map_err(js_err)?),
        };
        serde_json::to_string(&bundle).map_err(js_err)
    }

    /// Starts an encrypted session with another device, from its public bundle.
    #[wasm_bindgen(js_name = startSession)]
    pub fn start_session(&mut self, remote_name: String, remote_bundle_json: String) -> Result<(), String> {
        let remote: PublicBundle = serde_json::from_str(&remote_bundle_json).map_err(js_err)?;
        let identity = IdentityKey::decode(&decode(&remote.identity_key)?).map_err(js_err)?;
        let bundle = PreKeyBundle::new(
            remote.registration_id,
            DeviceId::new(remote.device_id as u8).map_err(js_err)?,
            Some((
                PreKeyId::from(remote.prekey_id),
                PublicKey::deserialize(&decode(&remote.prekey_public)?).map_err(js_err)?,
            )),
            SignedPreKeyId::from(remote.signed_prekey_id),
            PublicKey::deserialize(&decode(&remote.signed_prekey_public)?).map_err(js_err)?,
            decode(&remote.signed_prekey_signature)?,
            KyberPreKeyId::from(remote.kyber_prekey_id),
            kem::PublicKey::deserialize(&decode(&remote.kyber_prekey_public)?).map_err(js_err)?,
            decode(&remote.kyber_prekey_signature)?,
            identity,
        )
        .map_err(js_err)?;

        let mut rng = rand::rng();
        block_on(process_prekey_bundle(
            &address(&remote_name)?,
            &address(&self.name)?,
            &mut self.store.sessions,
            &mut self.store.identity,
            &bundle,
            now(),
            &mut rng,
        ))
        .map_err(js_err)
    }

    /// Encrypts a message for a remote device. The result starts with a type tag.
    pub fn encrypt(&mut self, remote_name: String, plaintext: Vec<u8>) -> Result<Vec<u8>, String> {
        let mut rng = rand::rng();
        let message = block_on(message_encrypt(
            &plaintext,
            &address(&remote_name)?,
            &address(&self.name)?,
            &mut self.store.sessions,
            &mut self.store.identity,
            now(),
            &mut rng,
        ))
        .map_err(js_err)?;

        let (tag, body) = match &message {
            CiphertextMessage::PreKeySignalMessage(m) => (TAG_PREKEY, m.serialized().to_vec()),
            CiphertextMessage::SignalMessage(m) => (TAG_WHISPER, m.serialized().to_vec()),
            _ => return Err(js_err("unexpected ciphertext type")),
        };
        let mut out = Vec::with_capacity(body.len() + 1);
        out.push(tag);
        out.extend_from_slice(&body);
        Ok(out)
    }

    /// Decrypts a message received from a remote device.
    pub fn decrypt(&mut self, remote_name: String, data: Vec<u8>) -> Result<Vec<u8>, String> {
        let (tag, body) = data.split_first().ok_or_else(|| js_err("empty ciphertext"))?;
        let message = match *tag {
            TAG_PREKEY => CiphertextMessage::PreKeySignalMessage(PreKeySignalMessage::try_from(body).map_err(js_err)?),
            TAG_WHISPER => CiphertextMessage::SignalMessage(SignalMessage::try_from(body).map_err(js_err)?),
            _ => return Err(js_err("unknown ciphertext type")),
        };

        let mut rng = rand::rng();
        block_on(message_decrypt(
            &message,
            &address(&remote_name)?,
            &address(&self.name)?,
            &mut self.store.sessions,
            &mut self.store.identity,
            &mut self.store.pre_keys,
            &self.store.signed_pre_keys,
            &mut self.store.kyber_pre_keys,
            &mut rng,
        ))
        .map_err(js_err)
    }

    /// Creates (once) this device's sender key for a group and returns the distribution
    /// envelope to encrypt to each other member with `encrypt`. Send it only over the
    /// 1:1 session, never in the clear.
    #[wasm_bindgen(js_name = createSenderKeyDistribution)]
    pub fn create_sender_key_distribution(&mut self, group_id: String) -> Result<Vec<u8>, String> {
        let mut rng = rand::rng();
        let distribution_id = match self.store.sender_keys.own_distribution(&group_id) {
            Some(id) => id,
            None => {
                let id = Uuid::from_u128(rng.random::<u128>());
                self.store.sender_keys.set_own_distribution(&group_id, id);
                id
            }
        };
        let skdm = block_on(create_sender_key_distribution_message(
            &address(&self.name)?,
            distribution_id,
            &mut self.store.sender_keys,
            &mut rng,
        ))
        .map_err(js_err)?;
        encode_distribution(&group_id, skdm.serialized())
    }

    /// Stores a sender key received from `sender_name` (the plaintext of a 1:1 message
    /// that carried a distribution envelope), so their group messages can be read.
    #[wasm_bindgen(js_name = processSenderKeyDistribution)]
    pub fn process_sender_key_distribution(&mut self, sender_name: String, data: Vec<u8>) -> Result<(), String> {
        let (group_id, skdm_bytes) = decode_distribution(&data)?;
        let skdm = SenderKeyDistributionMessage::try_from(skdm_bytes).map_err(js_err)?;
        let distribution_id = skdm.distribution_id().map_err(js_err)?;
        block_on(process_sender_key_distribution_message(
            &address(&sender_name)?,
            &skdm,
            &mut self.store.sender_keys,
        ))
        .map_err(js_err)?;
        self.store.sender_keys.remember_received(&sender_name, &group_id, distribution_id);
        Ok(())
    }

    /// Discards this device's sender key for a group. The next `createSenderKeyDistribution`
    /// starts a new chain, which members who were removed never receive. Call it when
    /// membership changes, before redistributing.
    #[wasm_bindgen(js_name = rotateSenderKey)]
    pub fn rotate_sender_key(&mut self, group_id: String) -> Result<(), String> {
        let own = address(&self.name)?;
        self.store.sender_keys.drop_own_distribution(&own, &group_id);
        Ok(())
    }

    /// Encrypts one plaintext for a group, once, with this device's sender key.
    #[wasm_bindgen(js_name = groupEncrypt)]
    pub fn group_encrypt(&mut self, group_id: String, plaintext: Vec<u8>) -> Result<Vec<u8>, String> {
        let distribution_id = self
            .store
            .sender_keys
            .own_distribution(&group_id)
            .ok_or_else(|| js_err("no sender key for this group; create and distribute one first"))?;
        let mut rng = rand::rng();
        let message = block_on(group_encrypt(
            &mut self.store.sender_keys,
            &address(&self.name)?,
            distribution_id,
            &plaintext,
            &mut rng,
        ))
        .map_err(js_err)?;
        Ok(message.serialized().to_vec())
    }

    /// Decrypts a group message from `sender_name`. Refuses any message whose key the
    /// sender did not announce for this group, so a key from another group cannot be used.
    #[wasm_bindgen(js_name = groupDecrypt)]
    pub fn group_decrypt(&mut self, sender_name: String, group_id: String, data: Vec<u8>) -> Result<Vec<u8>, String> {
        let message = SenderKeyMessage::try_from(&data[..]).map_err(js_err)?;
        if !self
            .store
            .sender_keys
            .has_received(&sender_name, &group_id, message.distribution_id())
        {
            return Err(js_err("no sender key from this sender for this group"));
        }
        block_on(group_decrypt(&data, &mut self.store.sender_keys, &address(&sender_name)?)).map_err(js_err)
    }

    /// Number of one-time prekeys this device created.
    #[wasm_bindgen(js_name = prekeyCount)]
    pub fn prekey_count(&self) -> u32 {
        self.prekey_count
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn two_devices_exchange_messages_end_to_end() {
        let mut bob = Device::new("bob".to_string(), 4242, 1).unwrap();
        let mut alice = Device::new("alice".to_string(), 1111, 0).unwrap();

        // Bob publishes his public bundle; Alice fetches it and starts a session.
        let bob_bundle = bob.public_bundle().unwrap();
        alice.start_session("bob".to_string(), bob_bundle).unwrap();

        let first = alice.encrypt("bob".to_string(), b"hello bob".to_vec()).unwrap();
        assert_eq!(first[0], TAG_PREKEY);
        assert_eq!(bob.decrypt("alice".to_string(), first).unwrap(), b"hello bob");

        let reply = bob.encrypt("alice".to_string(), b"hi alice".to_vec()).unwrap();
        assert_eq!(reply[0], TAG_WHISPER);
        assert_eq!(alice.decrypt("bob".to_string(), reply).unwrap(), b"hi alice");

        let again = alice.encrypt("bob".to_string(), b"ratchet moved".to_vec()).unwrap();
        assert_eq!(bob.decrypt("alice".to_string(), again).unwrap(), b"ratchet moved");
    }

    #[test]
    fn a_tampered_message_is_rejected() {
        let mut bob = Device::new("bob".to_string(), 4242, 1).unwrap();
        let mut alice = Device::new("alice".to_string(), 1111, 0).unwrap();
        alice.start_session("bob".to_string(), bob.public_bundle().unwrap()).unwrap();

        let mut sealed = alice.encrypt("bob".to_string(), b"secret".to_vec()).unwrap();
        let last = sealed.len() - 1;
        sealed[last] ^= 0x01;
        assert!(bob.decrypt("alice".to_string(), sealed).is_err());
    }

    #[test]
    fn a_device_restored_from_its_export_still_reads_and_replies() {
        let mut bob = Device::new("bob".to_string(), 4242, 2).unwrap();
        let mut alice = Device::new("alice".to_string(), 1111, 0).unwrap();
        alice.start_session("bob".to_string(), bob.public_bundle().unwrap()).unwrap();
        let first = alice.encrypt("bob".to_string(), b"before reload".to_vec()).unwrap();
        assert_eq!(bob.decrypt("alice".to_string(), first).unwrap(), b"before reload");

        // Simulate a page reload: Bob's state is exported and restored into a new object.
        let exported = bob.export().unwrap();
        let mut bob_after_reload = Device::restore("bob".to_string(), exported).unwrap();

        let second = alice.encrypt("bob".to_string(), b"after reload".to_vec()).unwrap();
        assert_eq!(bob_after_reload.decrypt("alice".to_string(), second).unwrap(), b"after reload");
        let reply = bob_after_reload.encrypt("alice".to_string(), b"still here".to_vec()).unwrap();
        assert_eq!(alice.decrypt("bob".to_string(), reply).unwrap(), b"still here");
    }

    /// Establishes a 1:1 session in one direction, with a first message to complete it.
    fn connect(from: &mut Device, to: &mut Device) {
        from.start_session(to.name.clone(), to.public_bundle().unwrap()).unwrap();
        let hello = from.encrypt(to.name.clone(), b"hello".to_vec()).unwrap();
        assert_eq!(to.decrypt(from.name.clone(), hello).unwrap(), b"hello");
    }

    /// Sends `sender`'s distribution envelope for a group to `recipient` over their 1:1 session.
    fn deliver_distribution(sender: &mut Device, recipient: &mut Device, group: &str) {
        let envelope = sender.create_sender_key_distribution(group.to_string()).unwrap();
        let sealed = sender.encrypt(recipient.name.clone(), envelope).unwrap();
        let plain = recipient.decrypt(sender.name.clone(), sealed).unwrap();
        recipient.process_sender_key_distribution(sender.name.clone(), plain).unwrap();
    }

    fn three_members() -> (Device, Device, Device) {
        let mut alice = Device::new("alice".to_string(), 1111, 3).unwrap();
        let mut bob = Device::new("bob".to_string(), 2222, 3).unwrap();
        let mut carol = Device::new("carol".to_string(), 3333, 3).unwrap();
        connect(&mut alice, &mut bob);
        connect(&mut alice, &mut carol);
        connect(&mut bob, &mut carol);
        (alice, bob, carol)
    }

    /// Every member delivers their sender key to every other member.
    fn distribute_all(group: &str, alice: &mut Device, bob: &mut Device, carol: &mut Device) {
        deliver_distribution(alice, bob, group);
        deliver_distribution(alice, carol, group);
        deliver_distribution(bob, alice, group);
        deliver_distribution(bob, carol, group);
        deliver_distribution(carol, alice, group);
        deliver_distribution(carol, bob, group);
    }

    #[test]
    fn three_members_read_each_others_group_messages() {
        let (mut alice, mut bob, mut carol) = three_members();
        distribute_all("group-1", &mut alice, &mut bob, &mut carol);

        let from_alice = alice.group_encrypt("group-1".to_string(), b"hi all, from alice".to_vec()).unwrap();
        assert_eq!(bob.group_decrypt("alice".to_string(), "group-1".to_string(), from_alice.clone()).unwrap(), b"hi all, from alice");
        assert_eq!(carol.group_decrypt("alice".to_string(), "group-1".to_string(), from_alice).unwrap(), b"hi all, from alice");

        let from_carol = carol.group_encrypt("group-1".to_string(), b"carol here".to_vec()).unwrap();
        assert_eq!(alice.group_decrypt("carol".to_string(), "group-1".to_string(), from_carol.clone()).unwrap(), b"carol here");
        assert_eq!(bob.group_decrypt("carol".to_string(), "group-1".to_string(), from_carol).unwrap(), b"carol here");

        // A key announced for one group does not open messages of another.
        let other_group = alice.group_encrypt("group-1".to_string(), b"again".to_vec()).unwrap();
        assert!(bob.group_decrypt("alice".to_string(), "group-2".to_string(), other_group).is_err());
    }

    #[test]
    fn a_group_message_needs_a_distribution_first() {
        let mut alice = Device::new("alice".to_string(), 1111, 1).unwrap();
        assert!(alice.group_encrypt("group-1".to_string(), b"too early".to_vec()).is_err());
    }

    #[test]
    fn a_removed_member_cannot_read_messages_after_the_sender_rotates() {
        let (mut alice, mut bob, mut carol) = three_members();
        distribute_all("group-1", &mut alice, &mut bob, &mut carol);

        let before = alice.group_encrypt("group-1".to_string(), b"before removal".to_vec()).unwrap();
        assert_eq!(carol.group_decrypt("alice".to_string(), "group-1".to_string(), before.clone()).unwrap(), b"before removal");
        assert_eq!(bob.group_decrypt("alice".to_string(), "group-1".to_string(), before).unwrap(), b"before removal");

        // Carol is removed. Alice and Bob rotate and send new keys to the remaining members only.
        alice.rotate_sender_key("group-1".to_string()).unwrap();
        deliver_distribution(&mut alice, &mut bob, "group-1");
        bob.rotate_sender_key("group-1".to_string()).unwrap();
        deliver_distribution(&mut bob, &mut alice, "group-1");

        let after = alice.group_encrypt("group-1".to_string(), b"carol must not read this".to_vec()).unwrap();
        assert_eq!(bob.group_decrypt("alice".to_string(), "group-1".to_string(), after.clone()).unwrap(), b"carol must not read this");
        assert!(carol.group_decrypt("alice".to_string(), "group-1".to_string(), after).is_err());

        // Bob's new message is readable by Alice but not by Carol.
        let from_bob = bob.group_encrypt("group-1".to_string(), b"still private".to_vec()).unwrap();
        assert_eq!(alice.group_decrypt("bob".to_string(), "group-1".to_string(), from_bob.clone()).unwrap(), b"still private");
        assert!(carol.group_decrypt("bob".to_string(), "group-1".to_string(), from_bob).is_err());
    }

    #[test]
    fn group_state_survives_export_and_restore() {
        let (mut alice, mut bob, mut carol) = three_members();
        distribute_all("group-1", &mut alice, &mut bob, &mut carol);
        let first = alice.group_encrypt("group-1".to_string(), b"one".to_vec()).unwrap();
        assert_eq!(bob.group_decrypt("alice".to_string(), "group-1".to_string(), first).unwrap(), b"one");

        // Bob reloads the page. His group keys must come back with his sessions.
        let mut bob = Device::restore("bob".to_string(), bob.export().unwrap()).unwrap();
        let second = alice.group_encrypt("group-1".to_string(), b"two".to_vec()).unwrap();
        assert_eq!(bob.group_decrypt("alice".to_string(), "group-1".to_string(), second).unwrap(), b"two");
        let reply = bob.group_encrypt("group-1".to_string(), b"three".to_vec()).unwrap();
        assert_eq!(carol.group_decrypt("bob".to_string(), "group-1".to_string(), reply).unwrap(), b"three");
    }

    #[test]
    fn exports_from_before_group_support_still_restore() {
        let bob = Device::new("bob".to_string(), 4242, 1).unwrap();
        let mut value: serde_json::Value = serde_json::from_str(&bob.export().unwrap()).unwrap();
        value.as_object_mut().unwrap().remove("sender_keys");
        let restored = Device::restore("bob".to_string(), value.to_string());
        assert!(restored.is_ok());
    }
}
