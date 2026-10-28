//! Drives the C ABI the same way the Dart binding does: allocate inputs, call,
//! check the status, copy the output, and free every pointer Rust handed back.
//! Run with: cargo test --features ffi --test ffi
#![cfg(feature = "ffi")]

use murih_e2ee::ffi::*;
use std::ffi::{c_char, CStr, CString};
use std::ptr;

/// Copies a Rust-allocated C string into a Rust String, then frees it, as Dart would.
unsafe fn take_string(p: *mut c_char) -> String {
    assert!(!p.is_null());
    let s = CStr::from_ptr(p).to_str().unwrap().to_owned();
    murih_string_free(p);
    s
}

/// Copies a Rust-allocated byte buffer into a Vec, then frees it.
unsafe fn take_bytes(b: MurihBytes) -> Vec<u8> {
    let copy = if b.len == 0 {
        Vec::new()
    } else {
        std::slice::from_raw_parts(b.ptr, b.len).to_vec()
    };
    murih_bytes_free(b.ptr, b.len);
    copy
}

fn cstr(s: &str) -> CString {
    CString::new(s).unwrap()
}

unsafe fn new_device(name: &str, reg_id: u32, prekeys: u32) -> *mut MurihDevice {
    let n = cstr(name);
    let mut err: *mut c_char = ptr::null_mut();
    let h = murih_device_new(n.as_ptr(), reg_id, prekeys, &mut err);
    assert!(!h.is_null(), "device_new failed: {}", take_string(err));
    assert!(err.is_null());
    h
}

unsafe fn public_bundle(h: *mut MurihDevice) -> String {
    let mut out: *mut c_char = ptr::null_mut();
    let mut err: *mut c_char = ptr::null_mut();
    assert_eq!(murih_device_public_bundle(h, &mut out, &mut err), 0);
    take_string(out)
}

unsafe fn start_session(h: *mut MurihDevice, remote: &str, bundle: &str) {
    let r = cstr(remote);
    let b = cstr(bundle);
    let mut err: *mut c_char = ptr::null_mut();
    let rc = murih_device_start_session(h, r.as_ptr(), b.as_ptr(), &mut err);
    assert_eq!(rc, 0, "start_session: {}", take_string(err));
}

unsafe fn encrypt(h: *mut MurihDevice, remote: &str, plain: &[u8]) -> Vec<u8> {
    let r = cstr(remote);
    let mut out = MurihBytes { ptr: ptr::null_mut(), len: 0 };
    let mut err: *mut c_char = ptr::null_mut();
    let rc = murih_device_encrypt(h, r.as_ptr(), plain.as_ptr(), plain.len(), &mut out, &mut err);
    assert_eq!(rc, 0, "encrypt: {}", take_string(err));
    take_bytes(out)
}

unsafe fn decrypt(h: *mut MurihDevice, remote: &str, sealed: &[u8]) -> Result<Vec<u8>, String> {
    let r = cstr(remote);
    let mut out = MurihBytes { ptr: ptr::null_mut(), len: 0 };
    let mut err: *mut c_char = ptr::null_mut();
    let rc = murih_device_decrypt(h, r.as_ptr(), sealed.as_ptr(), sealed.len(), &mut out, &mut err);
    if rc == 0 {
        assert!(err.is_null());
        Ok(take_bytes(out))
    } else {
        assert!(out.ptr.is_null(), "failed call must not write output");
        Err(take_string(err))
    }
}

#[test]
fn full_round_trip_through_the_c_layer() {
    unsafe {
        let bob = new_device("bob", 4242, 2);
        let alice = new_device("alice", 1111, 0);

        // Bob publishes his bundle; Alice fetches it and starts a session.
        let bob_bundle = public_bundle(bob);
        start_session(alice, "bob", &bob_bundle);

        let first = encrypt(alice, "bob", b"hello bob");
        assert_eq!(first[0], 3, "first message is a PreKey message");
        assert_eq!(decrypt(bob, "alice", &first).unwrap(), b"hello bob");

        let reply = encrypt(bob, "alice", b"hi alice");
        assert_eq!(decrypt(alice, "bob", &reply).unwrap(), b"hi alice");

        // Bob is restarted: export his state (as the app would store it), free the
        // handle, restore into a new handle, and keep talking.
        let mut state: *mut c_char = ptr::null_mut();
        let mut err: *mut c_char = ptr::null_mut();
        assert_eq!(murih_device_export(bob, &mut state, &mut err), 0);
        let state_json = take_string(state);
        murih_device_free(bob);

        let bn = cstr("bob");
        let sj = cstr(&state_json);
        let bob2 = murih_device_restore(bn.as_ptr(), sj.as_ptr(), &mut err);
        assert!(!bob2.is_null(), "restore: {}", take_string(err));

        let second = encrypt(alice, "bob", b"after restart");
        assert_eq!(decrypt(bob2, "alice", &second).unwrap(), b"after restart");

        murih_device_free(alice);
        murih_device_free(bob2);
    }
}

#[test]
fn tampered_ciphertext_is_reported_as_an_error() {
    unsafe {
        let bob = new_device("bob", 4242, 1);
        let alice = new_device("alice", 1111, 0);
        start_session(alice, "bob", &public_bundle(bob));

        let mut sealed = encrypt(alice, "bob", b"secret");
        let last = sealed.len() - 1;
        sealed[last] ^= 0x01;

        let msg = decrypt(bob, "alice", &sealed).unwrap_err();
        assert!(!msg.is_empty());

        murih_device_free(alice);
        murih_device_free(bob);
    }
}

#[test]
fn bad_arguments_fail_cleanly() {
    unsafe {
        let mut err: *mut c_char = ptr::null_mut();

        // NULL name.
        let h = murih_device_new(ptr::null(), 1, 1, &mut err);
        assert!(h.is_null());
        assert!(take_string(err).contains("name is NULL"));

        // Invalid UTF-8 in a name.
        let bad = [0xffu8, 0xfe, 0x00];
        let h = murih_device_new(bad.as_ptr() as *const c_char, 1, 1, &mut err);
        assert!(h.is_null());
        assert!(take_string(err).contains("UTF-8"));

        // NULL handle is an error, not a crash.
        let mut out: *mut c_char = ptr::null_mut();
        assert_eq!(murih_device_export(ptr::null_mut(), &mut out, &mut err), -1);
        assert!(out.is_null());
        assert!(take_string(err).contains("handle is NULL"));

        // Frees accept NULL.
        murih_device_free(ptr::null_mut());
        murih_string_free(ptr::null_mut());
        murih_bytes_free(ptr::null_mut(), 0);
    }
}

#[test]
fn empty_plaintext_round_trips() {
    unsafe {
        let bob = new_device("bob", 4242, 1);
        let alice = new_device("alice", 1111, 0);
        start_session(alice, "bob", &public_bundle(bob));
        let sealed = encrypt(alice, "bob", b"");
        assert_eq!(decrypt(bob, "alice", &sealed).unwrap(), b"");
        murih_device_free(alice);
        murih_device_free(bob);
    }
}
