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
    kem, message_decrypt, message_encrypt, process_prekey_bundle, CiphertextMessage, DeviceId,
    GenericSignedPreKey, IdentityKey, IdentityKeyPair, IdentityKeyStore, KeyPair, KyberPreKeyId,
    KyberPreKeyRecord, KyberPreKeyStore, PreKeyBundle, PreKeyId, PreKeyRecord, PreKeySignalMessage,
    PreKeyStore, ProtocolAddress, PublicKey, SignalMessage, SignalProtocolError, SignedPreKeyId,
    SignedPreKeyRecord, SignedPreKeyStore, Timestamp,
};
use serde::{Deserialize, Serialize};
use std::time::SystemTime;
use store::DeviceStore;
use wasm_bindgen::prelude::*;

/// The first byte of every ciphertext says which Signal message type follows.
const TAG_PREKEY: u8 = 3;
const TAG_WHISPER: u8 = 2;

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
        let first_pre_key = block_on(self.store.pre_keys.get_pre_key(PreKeyId::from(1u32))).map_err(js_err)?;

        let bundle = PublicBundle {
            registration_id: block_on(self.store.identity.get_local_registration_id()).map_err(js_err)?,
            device_id: 1,
            identity_key: BASE64_STANDARD.encode(identity.identity_key().serialize()),
            prekey_id: 1,
            prekey_public: BASE64_STANDARD.encode(first_pre_key.public_key().map_err(js_err)?.serialize()),
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
}
