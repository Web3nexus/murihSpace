//! Signal protocol primitives for MuriSpace end-to-end encryption.
//!
//! The server never sees keys or plaintext. Each device creates its keys here,
//! publishes only the public parts, and encrypts or decrypts on the device.

use libsignal_protocol::{
    kem, message_decrypt, message_encrypt, process_prekey_bundle, CiphertextMessage, DeviceId,
    GenericSignedPreKey, IdentityKeyPair, IdentityKeyStore, InMemSignalProtocolStore, KeyPair,
    KyberPreKeyId, KyberPreKeyRecord, KyberPreKeyStore, PreKeyBundle, PreKeyId, PreKeyRecord,
    PreKeyStore, ProtocolAddress, SignalProtocolError, SignedPreKeyId, SignedPreKeyRecord,
    SignedPreKeyStore, Timestamp,
};
use std::time::SystemTime;

/// Creates a device's full key set and returns its store, which holds the private keys.
/// The public parts are what gets uploaded to the key directory.
pub async fn new_device(
    registration_id: u32,
    prekey_count: u32,
) -> Result<InMemSignalProtocolStore, SignalProtocolError> {
    let mut rng = rand::rng();
    let identity = IdentityKeyPair::generate(&mut rng);
    let mut store = InMemSignalProtocolStore::new(identity, registration_id)?;

    let signed_id = SignedPreKeyId::from(1u32);
    let signed_pair = KeyPair::generate(&mut rng);
    let signed_sig = identity.private_key().calculate_signature(&signed_pair.public_key.serialize(), &mut rng)?;
    let now = Timestamp::from_epoch_millis(now_millis());
    store
        .signed_pre_key_store
        .save_signed_pre_key(signed_id, &SignedPreKeyRecord::new(signed_id, now, &signed_pair, &signed_sig))
        .await?;

    let kyber_id = KyberPreKeyId::from(1u32);
    let kyber_record = KyberPreKeyRecord::generate(kem::KeyType::Kyber1024, kyber_id, identity.private_key())?;
    store.kyber_pre_key_store.save_kyber_pre_key(kyber_id, &kyber_record).await?;

    for id in 1..=prekey_count {
        let pre_key_id = PreKeyId::from(id);
        let pair = KeyPair::generate(&mut rng);
        store.pre_key_store.save_pre_key(pre_key_id, &PreKeyRecord::new(pre_key_id, &pair)).await?;
    }
    Ok(store)
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::executor::block_on;

    #[test]
    fn two_devices_exchange_messages_end_to_end() {
        block_on(async {
            let mut rng = rand::rng();
            let alice_addr = ProtocolAddress::new("alice".to_string(), DeviceId::new(1).unwrap());
            let bob_addr = ProtocolAddress::new("bob".to_string(), DeviceId::new(1).unwrap());

            let mut bob = new_device(4242, 1).await.unwrap();
            let mut alice = new_device(1111, 0).await.unwrap();

            // Bob's public bundle, as the server would hand it out.
            let bob_identity = bob.identity_store.get_identity_key_pair().await.unwrap();
            let pre_key = bob.pre_key_store.get_pre_key(PreKeyId::from(1u32)).await.unwrap();
            let signed = bob.signed_pre_key_store.get_signed_pre_key(SignedPreKeyId::from(1u32)).await.unwrap();
            let kyber = bob.kyber_pre_key_store.get_kyber_pre_key(KyberPreKeyId::from(1u32)).await.unwrap();
            let bundle = PreKeyBundle::new(
                4242,
                DeviceId::new(1).unwrap(),
                Some((PreKeyId::from(1u32), pre_key.public_key().unwrap())),
                SignedPreKeyId::from(1u32),
                signed.public_key().unwrap(),
                signed.signature().unwrap(),
                KyberPreKeyId::from(1u32),
                kyber.public_key().unwrap(),
                kyber.signature().unwrap(),
                *bob_identity.identity_key(),
            )
            .unwrap();

            process_prekey_bundle(
                &bob_addr,
                &alice_addr,
                &mut alice.session_store,
                &mut alice.identity_store,
                &bundle,
                SystemTime::now(),
                &mut rng,
            )
            .await
            .unwrap();

            let ciphertext = message_encrypt(
                b"hello bob",
                &bob_addr,
                &alice_addr,
                &mut alice.session_store,
                &mut alice.identity_store,
                SystemTime::now(),
                &mut rng,
            )
            .await
            .unwrap();
            assert!(matches!(ciphertext, CiphertextMessage::PreKeySignalMessage(_)));

            let plaintext = message_decrypt(
                &ciphertext,
                &alice_addr,
                &bob_addr,
                &mut bob.session_store,
                &mut bob.identity_store,
                &mut bob.pre_key_store,
                &bob.signed_pre_key_store,
                &mut bob.kyber_pre_key_store,
                &mut rng,
            )
            .await
            .unwrap();
            assert_eq!(plaintext, b"hello bob");
        });
    }
}
