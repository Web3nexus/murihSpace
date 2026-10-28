/**
 * Loads the Signal protocol bridge (Rust compiled to WebAssembly). The generated
 * files in ./wasm are built from web/e2ee-bridge with wasm-bindgen --target web.
 */
import init from './wasm/murih_e2ee.js';

export { Device } from './wasm/murih_e2ee.js';

let ready: Promise<unknown> | null = null;

/** Instantiates the WebAssembly module once. Safe to call repeatedly. */
export function loadBridge(): Promise<unknown> {
  if (!ready) {
    ready = init().catch((error: unknown) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

/** A one-time prekey as it appears in a bundle. */
export interface OneTimePrekeyJson {
  id: number;
  public_key: string;
}

/**
 * A device's public bundle, in the flat shape of the bridge's `publicBundle` and of the
 * key directory (`E2eeKeyController::bundles` adds `device_uuid` to each element).
 * `one_time_prekey` is null when the device has none left.
 */
export interface PublicBundleJson {
  registration_id: number;
  identity_key: string;
  signed_prekey_id: number;
  signed_prekey_public: string;
  signed_prekey_signature: string;
  kyber_prekey_id: number;
  kyber_prekey_public: string;
  kyber_prekey_signature: string;
  one_time_prekey: OneTimePrekeyJson | null;
}

/** One entry returned by the bridge's `generatePrekeys`. */
export interface GeneratedPrekeyJson {
  key_id: number;
  public_key: string;
}
