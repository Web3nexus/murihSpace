/**
 * Local cache of decrypted message text, plus the per-sender receive queue.
 *
 * Ratchet sessions decrypt each message once. Decrypting a message a second time
 * fails, so every plaintext that is shown is kept here, sealed with the device's
 * vault key, and read back on later loads instead of being decrypted again.
 *
 * This module has no browser storage or bridge imports. The storage and the
 * device are passed in, so the logic can be tested with fakes.
 */
import { logger } from '@/lib/logger';
import { open, seal, type SealedRecord } from './vault';

/** Where sealed cache records are kept. Keys are already namespaced by user. */
export interface SealedStore {
  load(storeKey: string): Promise<SealedRecord | null>;
  save(storeKey: string, sealed: SealedRecord): Promise<void>;
}

export interface PlaintextCache {
  get(cacheKey: string): Promise<string | null>;
  put(cacheKey: string, text: string): Promise<void>;
}

interface CachedText {
  /** The cache key, sealed with the text so a record cannot answer for another message. */
  k: string;
  t: string;
}

export function createPlaintextCache(options: {
  userId: number;
  sealingKey: CryptoKey;
  store: SealedStore;
}): PlaintextCache {
  const { userId, sealingKey, store } = options;
  const storeKeyFor = (cacheKey: string): string => `${userId}:${cacheKey}`;
  return {
    async get(cacheKey) {
      const sealed = await store.load(storeKeyFor(cacheKey));
      if (!sealed) return null;
      const value = await open<CachedText>(sealingKey, userId, sealed);
      if (value.k !== cacheKey) throw new Error('Cached plaintext does not match its message');
      return value.t;
    },
    async put(cacheKey, text) {
      const value: CachedText = { k: cacheKey, t: text };
      const sealed = await seal(sealingKey, userId, value);
      await store.save(storeKeyFor(cacheKey), sealed);
    },
  };
}

/**
 * The key a message's plaintext is cached under. The server message ID is stable for
 * both sender and recipient; the client UUID is used only before an ID exists.
 */
export function cacheKeyFor(msg: { id?: number; client_uuid?: string }): string | null {
  if (msg.id !== undefined) return `id:${msg.id}`;
  if (msg.client_uuid) return `uuid:${msg.client_uuid}`;
  return null;
}

export type SenderQueue = <T>(senderId: number, task: () => Promise<T>) => Promise<T>;

/**
 * Runs tasks for each sender one at a time, in the order they were enqueued.
 * Different senders run independently.
 */
export function createReceiveQueue(): SenderQueue {
  const tails = new Map<number, Promise<void>>();
  return <T>(senderId: number, task: () => Promise<T>): Promise<T> => {
    const previous = tails.get(senderId) ?? Promise.resolve();
    const run = previous.then(task);
    const tail: Promise<void> = run.then(() => undefined, () => undefined);
    tails.set(senderId, tail);
    void tail.then(() => {
      if (tails.get(senderId) === tail) tails.delete(senderId);
    });
    return run;
  };
}

export interface PlaintextReceiver {
  /** The cached text for a message, or null. Never decrypts. Used for own messages too. */
  lookup(cacheKey: string | null): Promise<string | null>;
  /**
   * Returns the text of an incoming message. Decrypts at most once per message: a cache
   * hit or a decryption already in flight is reused. Rejects if decryption fails.
   */
  receive(senderId: number, cacheKey: string | null, ciphertext: string): Promise<string>;
  /** Stores text the user typed and sent, so the sender can read it after a reload. */
  remember(cacheKey: string, text: string): Promise<void>;
}

export function createReceiver(options: {
  cache: PlaintextCache;
  decrypt: (senderId: number, ciphertext: string) => Promise<string>;
  enqueue?: SenderQueue;
}): PlaintextReceiver {
  const { cache, decrypt } = options;
  const enqueue = options.enqueue ?? createReceiveQueue();
  const inFlight = new Map<string, Promise<string>>();

  return {
    lookup(cacheKey) {
      return cacheKey ? cache.get(cacheKey) : Promise.resolve(null);
    },

    receive(senderId, cacheKey, ciphertext) {
      if (cacheKey) {
        const pending = inFlight.get(cacheKey);
        if (pending) return pending;
      }
      const job = enqueue(senderId, async () => {
        // Checked inside the queue: an earlier job for this sender may have cached it.
        if (cacheKey) {
          const cached = await cache.get(cacheKey);
          if (cached !== null) return cached;
        }
        const text = await decrypt(senderId, ciphertext);
        if (cacheKey) {
          try {
            await cache.put(cacheKey, text);
          } catch (error) {
            // The text is still shown; after a reload it shows the placeholder instead.
            logger.error('Failed to cache decrypted message', error);
          }
        }
        return text;
      });
      if (cacheKey) {
        inFlight.set(cacheKey, job);
        const clear = () => {
          if (inFlight.get(cacheKey) === job) inFlight.delete(cacheKey);
        };
        job.then(clear, clear);
      }
      return job;
    },

    remember(cacheKey, text) {
      return cache.put(cacheKey, text);
    },
  };
}
