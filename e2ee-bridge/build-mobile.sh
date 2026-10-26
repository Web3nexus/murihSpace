#!/usr/bin/env bash
# Builds the murih-e2ee C ABI for the Flutter app.
#
#   ./build-mobile.sh host       host dylib + staticlib (tests, nm checks)
#   ./build-mobile.sh android    libmurih_e2ee.so for arm64, armv7, x86_64 into OUT_JNI
#   ./build-mobile.sh ios        device and simulator static libraries into OUT_IOS
#   ./build-mobile.sh header     regenerate include/murih_e2ee.h with cbindgen
#
# Requires: rustup targets (see docs/e2ee-flutter.md), Android NDK (ANDROID_NDK_HOME
# or the default under ~/Library/Android/sdk/ndk), Xcode command line tools for iOS.
set -euo pipefail

cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"
export IPHONEOS_DEPLOYMENT_TARGET=15.0
ANDROID_API=21
NDK_VERSION=28.2.13676358
NDK_HOME_DEFAULT="$HOME/Library/Android/sdk/ndk/$NDK_VERSION"
NDK_HOME_DIR="${ANDROID_NDK_HOME:-$NDK_HOME_DEFAULT}"
NDK_BIN="$NDK_HOME_DIR/toolchains/llvm/prebuilt/darwin-x86_64/bin"
OUT_JNI="${OUT_JNI:-../mobile/android/app/src/main/jniLibs}"
OUT_IOS="${OUT_IOS:-build/ios}"

build_android_target() {
  local triple="$1" abi="$2" clang="$3" env_triple="$4"
  local linker="$NDK_BIN/${clang}${ANDROID_API}-clang"
  env "CARGO_TARGET_${env_triple}_LINKER=$linker" \
      "CC_${triple//-/_}=$linker" \
      "AR_${triple//-/_}=$NDK_BIN/llvm-ar" \
      cargo build --release --features ffi --target "$triple"
  mkdir -p "$OUT_JNI/$abi"
  cp "target/$triple/release/libmurih_e2ee.so" "$OUT_JNI/$abi/libmurih_e2ee.so"
}

case "${1:-host}" in
  host)
    cargo build --release --features ffi
    ;;
  android)
    build_android_target aarch64-linux-android arm64-v8a aarch64-linux-android AARCH64_LINUX_ANDROID
    build_android_target armv7-linux-androideabi armeabi-v7a armv7a-linux-androideabi ARMV7_LINUX_ANDROIDEABI
    build_android_target x86_64-linux-android x86_64 x86_64-linux-android X86_64_LINUX_ANDROID
    ;;
  ios)
    # Static libraries only. The Runner target links them and forces the symbols to stay.
    mkdir -p "$OUT_IOS"
    cargo rustc --release --features ffi --crate-type staticlib --target aarch64-apple-ios
    cp target/aarch64-apple-ios/release/libmurih_e2ee.a "$OUT_IOS/libmurih_e2ee-device.a"
    cargo rustc --release --features ffi --crate-type staticlib --target aarch64-apple-ios-sim
    cargo rustc --release --features ffi --crate-type staticlib --target x86_64-apple-ios
    lipo -create \
      target/aarch64-apple-ios-sim/release/libmurih_e2ee.a \
      target/x86_64-apple-ios/release/libmurih_e2ee.a \
      -output "$OUT_IOS/libmurih_e2ee-simulator.a"
    ;;
  header)
    mkdir -p include
    cbindgen --config cbindgen.toml --lang c --output include/murih_e2ee.h src/ffi.rs
    ;;
  *)
    echo "usage: $0 host|android|ios|header" >&2
    exit 2
    ;;
esac
