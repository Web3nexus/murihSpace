/**
 * The app's receiver for one signed-in user: the plaintext cache sealed with the
 * device's vault key, and the device's decrypt function.
 */
import { receiveDecrypted } from './device';
import { createPlaintextCache, createReceiver, type PlaintextReceiver } from './plaintextCache';
import { getWrapKey, loadSealedMessage, saveSealedMessage } from './vault';

const receivers = new Map<number, Promise<PlaintextReceiver>>();

/** One receiver per user, so every view shares the same per-sender queue. */
export function receiverFor(userId: number): Promise<PlaintextReceiver> {
  let receiver = receivers.get(userId);
  if (!receiver) {
    receiver = getWrapKey().then((sealingKey) => createReceiver({
      cache: createPlaintextCache({
        userId,
        sealingKey,
        store: { load: loadSealedMessage, save: saveSealedMessage },
      }),
      decrypt: receiveDecrypted,
    }));
    receiver.catch(() => receivers.delete(userId));
    receivers.set(userId, receiver);
  }
  return receiver;
}
