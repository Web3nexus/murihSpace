import {
  BaseKeyProvider,
  createKeyMaterialFromBuffer,
  type E2EEOptions,
} from 'livekit-client';
import type { RoomKeyring } from './roomKey';

/**
 * LiveKit key provider that takes raw room key bytes from RoomKeyManager.
 *
 * ExternalE2EEKeyProvider cannot be used here: its setKey() always writes slot 0,
 * so a rotated key would overwrite the one that frames still in flight use.
 * BaseKeyProvider.onSetEncryptionKey accepts an explicit keyIndex.
 */
export class RoomKeyProvider extends BaseKeyProvider implements RoomKeyring {
  constructor() {
    super({
      sharedKey: true,
      // Every participant holds the same key, so a decrypt failure must not trigger auto-ratchet.
      ratchetWindowSize: 0,
      failureTolerance: -1,
      keyringSize: 16,
    });
  }

  async setRoomKey(raw: Uint8Array, keyIndex: number): Promise<void> {
    const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
    const key = await createKeyMaterialFromBuffer(buffer);
    this.onSetEncryptionKey(key, undefined, keyIndex);
  }
}

/**
 * Builds the Room `e2ee` option and the key provider that feeds it.
 * The worker runs LiveKit's frame encryption off the main thread.
 */
export function createE2eeRoomSetup(): { keyProvider: RoomKeyProvider; e2ee: E2EEOptions } {
  const keyProvider = new RoomKeyProvider();
  const worker = new Worker(new URL('livekit-client/e2ee-worker', import.meta.url), {
    type: 'module',
  });
  return { keyProvider, e2ee: { keyProvider, worker } };
}
