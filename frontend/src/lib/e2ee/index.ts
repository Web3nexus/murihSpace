/**
 * End-to-end encryption for direct messages (Signal protocol via the WebAssembly bridge).
 * Only ciphertext and public keys leave the browser.
 */
export {
  ensureDevice,
  releaseDevice,
  sendEncrypted,
  receiveDecrypted,
  E2eeError,
  type E2eeErrorCode,
} from './device';
export { DirectoryError } from './directory';
