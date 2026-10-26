//! C ABI for the Flutter app (dart:ffi on Android and iOS).
//!
//! Compiled only with the `ffi` cargo feature. The WebAssembly build does not
//! enable it, so its output is unchanged.
//!
//! Ownership rules (every function is `unsafe` to call, since it takes raw pointers):
//! - Device handles: `murih_device_new` and `murih_device_restore` return a
//!   `*mut MurihDevice` that the caller owns. Release it with `murih_device_free`
//!   exactly once. NULL means failure; the reason is in `err`.
//! - Input strings are NUL-terminated UTF-8. Rust only borrows them during the call.
//! - Input byte buffers (`ptr`, `len`) are borrowed during the call. `len` may be 0.
//! - Output strings (`char**`) and output byte buffers (`MurihBytes*`) are allocated
//!   by Rust and owned by the caller. Free them with `murih_string_free` and
//!   `murih_bytes_free`. Do not free them with malloc/free.
//! - `err` is an optional out-parameter (pass NULL to ignore). On failure Rust writes
//!   a message there, and the caller frees it with `murih_string_free`. On success it
//!   is set to NULL.
//! - A device handle is not thread-safe. Dart must not use one handle from two
//!   isolates or threads at the same time.
//! - Panics are caught and reported as errors. They never unwind into C.

use crate::Device;
use std::ffi::{c_char, CStr, CString};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::ptr;

/// Opaque handle. C and Dart see only a pointer to this type.
#[repr(C)]
pub struct MurihDevice {
    _private: [u8; 0],
}

/// A byte buffer allocated by Rust. Free it with `murih_bytes_free(ptr, len)`.
#[repr(C)]
pub struct MurihBytes {
    pub ptr: *mut u8,
    pub len: usize,
}

const OK: i32 = 0;
const ERR: i32 = -1;

unsafe fn clear_err(err: *mut *mut c_char) {
    if !err.is_null() {
        *err = ptr::null_mut();
    }
}

unsafe fn set_err(err: *mut *mut c_char, message: &str) {
    if !err.is_null() {
        let clean = message.replace('\0', " ");
        // The replacement above removes every NUL byte, so this cannot fail.
        *err = CString::new(clean).unwrap_or_default().into_raw();
    }
}

/// Runs `f`, turning errors and panics into `None` and writing the message to `err`.
fn guard<T>(err: *mut *mut c_char, f: impl FnOnce() -> Result<T, String>) -> Option<T> {
    match catch_unwind(AssertUnwindSafe(f)) {
        Ok(Ok(value)) => Some(value),
        Ok(Err(message)) => {
            unsafe { set_err(err, &message) };
            None
        }
        Err(_) => {
            unsafe { set_err(err, "internal error (panic) in murih-e2ee") };
            None
        }
    }
}

unsafe fn read_str<'a>(p: *const c_char, what: &str) -> Result<&'a str, String> {
    if p.is_null() {
        return Err(format!("{what} is NULL"));
    }
    CStr::from_ptr(p)
        .to_str()
        .map_err(|_| format!("{what} is not valid UTF-8"))
}

unsafe fn read_bytes<'a>(p: *const u8, len: usize, what: &str) -> Result<&'a [u8], String> {
    if len == 0 {
        return Ok(&[]);
    }
    if p.is_null() {
        return Err(format!("{what} is NULL but length is {len}"));
    }
    Ok(std::slice::from_raw_parts(p, len))
}

unsafe fn device<'a>(handle: *mut MurihDevice) -> Result<&'a mut Device, String> {
    handle
        .cast::<Device>()
        .as_mut()
        .ok_or_else(|| "device handle is NULL".to_string())
}

unsafe fn write_string(out: *mut *mut c_char, value: String) -> Result<(), String> {
    if out.is_null() {
        return Err("output string pointer is NULL".to_string());
    }
    let c = CString::new(value).map_err(|_| "output contains a NUL byte".to_string())?;
    *out = c.into_raw();
    Ok(())
}

unsafe fn write_bytes(out: *mut MurihBytes, value: Vec<u8>) -> Result<(), String> {
    if out.is_null() {
        return Err("output buffer pointer is NULL".to_string());
    }
    let boxed = value.into_boxed_slice();
    let len = boxed.len();
    let ptr = Box::into_raw(boxed) as *mut u8;
    *out = MurihBytes { ptr, len };
    Ok(())
}

/// Creates a new device with fresh keys. Returns NULL on failure.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn murih_device_new(
    name: *const c_char,
    registration_id: u32,
    prekey_count: u32,
    err: *mut *mut c_char,
) -> *mut MurihDevice {
    clear_err(err);
    guard(err, || {
        let name = read_str(name, "name")?.to_string();
        Device::new(name, registration_id, prekey_count)
    })
    .map_or(ptr::null_mut(), |d| Box::into_raw(Box::new(d)).cast::<MurihDevice>())
}

/// Restores a device from the JSON produced by `murih_device_export`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn murih_device_restore(
    name: *const c_char,
    state_json: *const c_char,
    err: *mut *mut c_char,
) -> *mut MurihDevice {
    clear_err(err);
    guard(err, || {
        let name = read_str(name, "name")?.to_string();
        let state = read_str(state_json, "state_json")?.to_string();
        Device::restore(name, state)
    })
    .map_or(ptr::null_mut(), |d| Box::into_raw(Box::new(d)).cast::<MurihDevice>())
}

/// Writes the device's full private state as JSON to `out_json` (caller frees with
/// `murih_string_free`). The caller must encrypt it before storing it.
/// Returns 0 on success, -1 on failure.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn murih_device_export(
    handle: *mut MurihDevice,
    out_json: *mut *mut c_char,
    err: *mut *mut c_char,
) -> i32 {
    clear_err(err);
    guard(err, || {
        let d = device(handle)?;
        let json = d.export()?;
        write_string(out_json, json)
    })
    .map_or(ERR, |_| OK)
}

/// Writes the public key bundle as JSON to `out_json` (caller frees with
/// `murih_string_free`). Upload this to the key directory.
/// Returns 0 on success, -1 on failure.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn murih_device_public_bundle(
    handle: *mut MurihDevice,
    out_json: *mut *mut c_char,
    err: *mut *mut c_char,
) -> i32 {
    clear_err(err);
    guard(err, || {
        let d = device(handle)?;
        let json = d.public_bundle()?;
        write_string(out_json, json)
    })
    .map_or(ERR, |_| OK)
}

/// Starts a session with a remote device from its public bundle JSON.
/// Returns 0 on success, -1 on failure.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn murih_device_start_session(
    handle: *mut MurihDevice,
    remote_name: *const c_char,
    remote_bundle_json: *const c_char,
    err: *mut *mut c_char,
) -> i32 {
    clear_err(err);
    guard(err, || {
        let d = device(handle)?;
        let remote = read_str(remote_name, "remote_name")?.to_string();
        let bundle = read_str(remote_bundle_json, "remote_bundle_json")?.to_string();
        d.start_session(remote, bundle)
    })
    .map_or(ERR, |_| OK)
}

/// Encrypts `plaintext` for `remote_name`. The ciphertext goes to `out` (caller frees
/// with `murih_bytes_free`). Returns 0 on success, -1 on failure.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn murih_device_encrypt(
    handle: *mut MurihDevice,
    remote_name: *const c_char,
    plaintext: *const u8,
    plaintext_len: usize,
    out: *mut MurihBytes,
    err: *mut *mut c_char,
) -> i32 {
    clear_err(err);
    guard(err, || {
        let d = device(handle)?;
        let remote = read_str(remote_name, "remote_name")?.to_string();
        let input = read_bytes(plaintext, plaintext_len, "plaintext")?.to_vec();
        let sealed = d.encrypt(remote, input)?;
        write_bytes(out, sealed)
    })
    .map_or(ERR, |_| OK)
}

/// Decrypts a ciphertext from `remote_name`. The plaintext goes to `out` (caller frees
/// with `murih_bytes_free`). Returns 0 on success, -1 on failure (for example, a
/// tampered message).
#[unsafe(no_mangle)]
pub unsafe extern "C" fn murih_device_decrypt(
    handle: *mut MurihDevice,
    remote_name: *const c_char,
    ciphertext: *const u8,
    ciphertext_len: usize,
    out: *mut MurihBytes,
    err: *mut *mut c_char,
) -> i32 {
    clear_err(err);
    guard(err, || {
        let d = device(handle)?;
        let remote = read_str(remote_name, "remote_name")?.to_string();
        let input = read_bytes(ciphertext, ciphertext_len, "ciphertext")?.to_vec();
        let plain = d.decrypt(remote, input)?;
        write_bytes(out, plain)
    })
    .map_or(ERR, |_| OK)
}

/// Frees a device handle. NULL is ignored. Do not free the same handle twice.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn murih_device_free(handle: *mut MurihDevice) {
    if !handle.is_null() {
        drop(Box::from_raw(handle.cast::<Device>()));
    }
}

/// Frees a string returned by this library (output strings and `err`). NULL is ignored.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn murih_string_free(s: *mut c_char) {
    if !s.is_null() {
        drop(CString::from_raw(s));
    }
}

/// Frees a byte buffer returned by this library. Pass the `ptr` and `len` fields
/// from the `MurihBytes` that was written. NULL is ignored.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn murih_bytes_free(ptr: *mut u8, len: usize) {
    if !ptr.is_null() {
        drop(Box::from_raw(std::ptr::slice_from_raw_parts_mut(ptr, len)));
    }
}
