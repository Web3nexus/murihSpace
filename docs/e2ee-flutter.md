# End-to-end encryption in the Flutter app

Plan item 5 (phone app). The Signal bridge in `e2ee-bridge/` (crate `murih-e2ee`) is
shared by the web app (WebAssembly) and the phone app (native C ABI through `dart:ffi`).
This document covers the native layer, the Dart binding, key storage, the chat send
path, and the build steps. The Flutter project lives outside this repo at
`/Users/vincent/Herd/murihspace/mobile`, so the Dart changes are described here, not committed.

## 1. What exists in this repo

| Piece | Location |
| --- | --- |
| C ABI (Rust, behind cargo feature `ffi`) | `e2ee-bridge/src/ffi.rs` |
| Native tests that drive the C ABI like Dart does | `e2ee-bridge/tests/ffi.rs` |
| Generated C header (cbindgen) | `e2ee-bridge/include/murih_e2ee.h` |
| cbindgen config | `e2ee-bridge/cbindgen.toml` |
| Build script (host, Android, iOS, header) | `e2ee-bridge/build-mobile.sh` |

The `ffi` feature is off by default, so the WebAssembly build is unchanged.

### C functions

| Function | Purpose | Returns |
| --- | --- | --- |
| `murih_device_new(name, registration_id, prekey_count, err)` | Fresh identity, signed, Kyber and one-time prekeys | handle or NULL |
| `murih_device_restore(name, state_json, err)` | Rebuild from `export` output | handle or NULL |
| `murih_device_export(h, out_json, err)` | Full private state as JSON | 0 / -1 |
| `murih_device_public_bundle(h, out_json, err)` | Public keys for the key directory | 0 / -1 |
| `murih_device_start_session(h, remote_name, remote_bundle_json, err)` | X3DH from a fetched bundle | 0 / -1 |
| `murih_device_encrypt(h, remote_name, ptr, len, out, err)` | Ciphertext (type-tag byte first) | 0 / -1 |
| `murih_device_decrypt(h, remote_name, ptr, len, out, err)` | Plaintext; fails on tampering | 0 / -1 |
| `murih_device_free(h)` | Release a handle | void |
| `murih_string_free(s)` | Release any string Rust returned, including `err` | void |
| `murih_bytes_free(ptr, len)` | Release a byte buffer Rust returned | void |

### Ownership rules

- Handles are owned by the caller. Free each one exactly once.
- Input strings and byte buffers are borrowed for the duration of the call. Dart copies them and frees its own memory.
- Output strings and `MurihBytes` buffers are allocated by Rust. Free them with the matching `*_free` function, never with `malloc`/`free`.
- `err` is optional. On failure Rust writes a message there, and the caller frees it. On success it is NULL.
- A handle is not thread-safe. Only one isolate may use it at a time.
- Panics are caught inside each function and reported as errors. They never unwind into Dart.

The native tests (`cargo test --features ffi`) run the same sequence Dart will: allocate,
call, check status, copy the output, free. They cover a full exchange, restart from an
export, tampered ciphertext, NULL and invalid-UTF-8 arguments, and empty plaintext.

## 2. Protocol gaps to resolve before the phone can talk to the server

These came from reading the bridge against `backend/app/Http/Controllers/E2eeKeyController.php`,
the migration `2026_10_26_120000_create_e2ee_key_tables.php`, and `ConversationController::sendMessage`.
Items 1 to 3 are resolved in the current code. Item 4 is still open.

1. **Resolved: Kyber prekey is stored and served.** The migration
   `2026_10_26_150000_add_kyber_prekeys_to_e2ee_devices.php` adds the Kyber columns, `register`
   accepts `kyber_prekey_*`, and `bundles` returns them, so the pinned libsignal `PreKeyBundle` can be built.
2. **Resolved: one-time prekeys are generated and advertised.** The bridge generates a batch of
   one-time prekeys and advertises them. The server accepts uploads (`POST /v1/e2ee/devices/{uuid}/prekeys`,
   up to 100 per upload) and reports the remaining count.
3. **Resolved: the bundle shape is flat.** The server returns
   `{device_uuid, registration_id, identity_key, signed_prekey:{id,public_key,signature}, one_time_prekey:{id,public_key}|null}`.
   `one_time_prekey` is `null` when prekeys run out, so the client must handle a bundle with no one-time prekey.
4. **Addressing and multi-device (open).** The bridge uses device id 1 and a caller-supplied name. Use the server user id
   (as a string) as the remote name on both sides. Multi-device per user is not handled yet.

## 3. Dart binding plan

- Files: `mobile/lib/core/e2ee/murih_e2ee_bindings.dart` (raw `dart:ffi` lookups) and
  `mobile/lib/core/e2ee/murih_device.dart` (the wrapper the app uses). A draft of the binding is in
  the session scratchpad, not in the repo.
- Add `ffi` to `mobile/pubspec.yaml` (`package:ffi` provides `toNativeUtf8` and `calloc`). It is not
  in the pubspec today.
- Loading:
  - Android: `DynamicLibrary.open('libmurih_e2ee.so')`, packaged from `android/app/src/main/jniLibs/<abi>/`.
  - iOS: `DynamicLibrary.process()`. The static library is linked into `Runner`. See section 6 (iOS) for the symbol-retention requirement.
- Wrapper: `MurihDevice` owns the handle. It has an explicit `close()` and a `NativeFinalizer`
  fallback. Errors surface as `MurihE2eeException`.
- Threading: run all handle calls on one long-lived background isolate. `Device::new` generates about
  100 prekeys and should not run on the UI isolate. Calls on a handle are serialised by that isolate.
- Dart lookups use the names in section 1. Signatures use `Int32` for status, `IntPtr` for lengths, and
  a `Struct` with `ptr` and `len` for `MurihBytes`.

## 4. Key storage

What must be protected: `export` output contains the identity private key, signed and Kyber private
keys, one-time prekeys, and session ratchet state. It is never stored in plaintext.

Plan:

1. On first run, generate a random 256-bit data key and store it in `flutter_secure_storage`
   (already in the pubspec, version ^10.3.1). On iOS it is Keychain. On Android it is Keystore-backed.
   Verify the Android and iOS options on a device before shipping. Use the iOS accessibility option
   `first_unlock_this_device` so background notifications can still decrypt, and do not sync to iCloud.
2. Encrypt the export JSON with AES-256-GCM under that key (`pointycastle` is already in the
   pubspec). Write the blob to the app support directory. Do not put the blob itself in secure storage,
   because Android storage size limits are unclear.
3. Store the `device_uuid` and `registration_id` alongside.
4. **Save after every state change.** `startSession`, `encrypt`, and `decrypt` all advance ratchet state.
   Persist the new export before the ciphertext is sent, or before the plaintext is shown. If the app
   dies in between, the session desyncs.
5. Logout deletes the blob and the data key. The backend has no device-delete endpoint yet, so the old
   device stays in the directory until a delete route exists.

## 5. Chat send path changes

Today `mobile/lib/providers/messages_provider.dart` `sendMessage` posts plaintext `content` to
`/conversations/{id}/messages`. For `signal_v1` the backend requires the opposite (see below). The
changes:

1. **Mark encrypted conversations.** Nothing in the backend or the `Conversation` model says a
   conversation is encrypted. Decide that first, per conversation or per user.
2. **Fetch and start sessions.** For each recipient user, `GET /v1/e2ee/users/{user}/bundles`
   (throttled to 30 per minute), then `startSession` for each device that has no session. Map the server
   shape to the bridge shape (section 2, item 3) and handle `one_time_prekey: null`.
3. **Send ciphertext only.** The backend requires `encryption: 'signal_v1'` with a non-empty
   `ciphertext`, and refuses any `content` on an encrypted message. Send
   `{ciphertext: base64(bytes), encryption: 'signal_v1', client_uuid}` with no `content`.
   The `ciphertext` field is capped at 65,536 characters. That limits a message to roughly 48 KB before
   base64 and before fan-out, so group chats and multi-device delivery need a different envelope
   (one row with per-device ciphertexts). The backend has one `ciphertext` column today.
4. **Idempotent retries.** On retry, resend the same ciphertext bytes stored for that `client_uuid`.
   Do not encrypt again, because each encryption advances the ratchet.
5. **Attachments.** `attachment_url` and `media_id` are sent in clear today. Encrypted messages with
   media need a design. Until then, do not send media for encrypted conversations.
6. **Receive path.** REST and realtime (Reverb) messages with `encryption == 'signal_v1'` must be
   decrypted before display. The `Message` model in `mobile/lib/models/chat_models.dart` has no
   `encryption` or `ciphertext` field today. Conversation previews must not show ciphertext. The backend
   already has a preview branch for encrypted rows (`ConversationController`, around line 568).
7. **Decrypt errors.** A failed decrypt should show a placeholder and log the event. It should not
   crash the list or drop the message silently.

## 6. Build steps

### Prerequisites

- Rust with targets: `rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios`
- `cargo install cbindgen --locked` (header generation only)
- Android NDK `28.2.13676358`, the version Flutter's gradle plugin defaults to (`FlutterExtension.kt`)
- Xcode with command line tools, for iOS. Runner deployment target is 15.0.

### Host (tests)

```sh
cd e2ee-bridge
cargo test --features ffi
cargo build --release --features ffi
nm -gU target/release/libmurih_e2ee.dylib | grep murih_
```

### Android

```sh
bash e2ee-bridge/build-mobile.sh android
```

Writes `libmurih_e2ee.so` for `arm64-v8a`, `armeabi-v7a`, and `x86_64` into
`mobile/android/app/src/main/jniLibs/`. Override the destination with `OUT_JNI`. Build in CI and do not
commit the binaries until the team decides how they are versioned.

### iOS

```sh
bash e2ee-bridge/build-mobile.sh ios
```

Produces `build/ios/libmurih_e2ee-device.a` (arm64) and `build/ios/libmurih_e2ee-simulator.a` (arm64 and
x86_64, combined with `lipo`). Then:

1. Create an XCFramework: `xcodebuild -create-xcframework -library <device.a> -library <simulator.a> -output MurihE2ee.xcframework`.
2. Add it to the `Runner` target under "Link Binary With Libraries".
3. Keep the symbols from being stripped. Add `-Wl,-force_load,<path>` to Other Linker Flags, or reference
   the symbols from a Swift or C file in `Runner`. Without this, `DynamicLibrary.process()` cannot find them.

### Flutter

```sh
cd mobile
flutter pub add ffi
flutter analyze
flutter build apk      # after the Android step
flutter build ios      # after the iOS step
```

### Rebuild rules

- Keep the libsignal pin (`fc90b90fa2b9c37822fa47ba0e0dcdf387a0c071`) unless you are deliberately upgrading.
  Changing it changes the protocol and breaks existing sessions.
- Rebuild the native libraries for every app release, and after any change to `src/ffi.rs`.
- Regenerate `include/murih_e2ee.h` with `bash e2ee-bridge/build-mobile.sh header` after changing the C API.

## 7. Build status on the development Mac

Checked on the development Mac (macOS 25, Xcode 26.5, Rust 1.98.1, NDK 28.2.13676358). Flutter was not built,
because the Dart binding is not in this repo.

| Step | Result |
| --- | --- |
| `cargo test` (default features) | 3 passed (unchanged) |
| `cargo test --features ffi` | 3 unit + 4 C-ABI tests passed |
| `cargo build --release --features ffi` (host) | Built. `nm -gU` shows all 10 `murih_*` functions |
| `cargo build --release --target wasm32-unknown-unknown` (no feature) | Built, unchanged |
| Android `aarch64`, `armv7`, `x86_64` (`build-mobile.sh android`) | Built. Each `.so` is the right ABI and exports the 10 functions |
| iOS device `aarch64-apple-ios` and simulator `aarch64` and `x86_64` (`build-mobile.sh ios`) | Built. A C caller links against both archives with Xcode's clang. The XCFramework builds |
| `cbindgen` header | `include/murih_e2ee.h` generated from `src/ffi.rs` |
| Flutter `pub add ffi`, `flutter analyze`, app build | Not run. The Dart binding is not in this repo |
| Running the iOS or Android app | Not run. No device or simulator run was attempted |

Known caveat: Xcode's `nm` prints "Unknown attribute kind" errors while reading the device archive. Its LLVM
is older than the one rustc uses. The symbols are still listed, and the link test passed. Run the real
app build to confirm the final linker is happy.
