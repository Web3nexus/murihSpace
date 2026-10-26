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

/** Public bundle JSON exactly as the bridge reads it in `startSession`. */
export interface PublicBundleJson {
  registration_id: number;
  device_id: number;
  identity_key: string;
  prekey_id: number;
  prekey_public: string;
  signed_prekey_id: number;
  signed_prekey_public: string;
  signed_prekey_signature: string;
  kyber_prekey_id: number;
  kyber_prekey_public: string;
  kyber_prekey_signature: string;
}
