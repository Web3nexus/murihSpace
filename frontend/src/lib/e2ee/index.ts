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
export {
  RoomKeyManager,
  ROOM_KEY_BYTES,
  KEYRING_SIZE,
  createRoomKey,
  encodeRoomKeyMessage,
  decodeRoomKeyMessage,
  type E2eePeerTransport,
  type RoomKeyring,
  type RoomKeyMessage,
  type RoomKeyManagerOptions,
} from './roomKey';
export { RoomKeyProvider, createE2eeRoomSetup } from './livekitE2ee';
