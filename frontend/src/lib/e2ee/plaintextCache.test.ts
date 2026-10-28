import { describe, expect, it, vi } from 'vitest';
import {
  cacheKeyFor,
  createPlaintextCache,
  createReceiveQueue,
  createReceiver,
  type SealedStore,
} from './plaintextCache';
import type { SealedRecord } from './vault';

async function sealingKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

/** In-memory stand-in for the IndexedDB message store. */
function memoryStore(): SealedStore & { rows: Map<string, SealedRecord> } {
  const rows = new Map<string, SealedRecord>();
  return {
    rows,
    async load(key) { return rows.get(key) ?? null; },
    async save(key, sealed) { rows.set(key, sealed); },
  };
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A fake ratchet for one device. Ciphertext "msg:N" is the Nth message from a sender.
 * Like the real ratchet, it only opens the next message in sequence, and a message
 * that was already opened fails when opened again.
 */
function fakeRatchet(options: { slowFirst?: boolean } = {}) {
  const next = new Map<number, number>();
  const decrypt = vi.fn(async (senderId: number, ciphertext: string): Promise<string> => {
    const index = Number(ciphertext.split(':')[1]);
    // Earlier messages finish later, so any missing ordering would show up here.
    await delay(options.slowFirst ? Math.max(1, 20 - index * 5) : 1);
    const expected = next.get(senderId) ?? 1;
    if (index !== expected) throw new Error(`out of order: expected ${expected}, got ${index}`);
    next.set(senderId, expected + 1);
    return `text ${index} from ${senderId}`;
  });
  return { decrypt };
}

describe('plaintext cache sealing', () => {
  it('round-trips text and never stores it unsealed', async () => {
    const store = memoryStore();
    const cache = createPlaintextCache({ userId: 7, sealingKey: await sealingKey(), store });
    await cache.put('id:42', 'super-secret-text-marker');
    await expect(cache.get('id:42')).resolves.toBe('super-secret-text-marker');

    const [[storeKey, sealed]] = [...store.rows.entries()];
    expect(storeKey).toBe('7:id:42');
    expect(new TextDecoder().decode(sealed.ciphertext)).not.toContain('super-secret-text-marker');
  });

  it('returns null for a message that was never cached', async () => {
    const cache = createPlaintextCache({ userId: 7, sealingKey: await sealingKey(), store: memoryStore() });
    await expect(cache.get('id:1')).resolves.toBeNull();
  });

  it('refuses a record copied under another message key', async () => {
    const store = memoryStore();
    const key = await sealingKey();
    const cache = createPlaintextCache({ userId: 7, sealingKey: key, store });
    await cache.put('id:1', 'first');
    store.rows.set('7:id:2', store.rows.get('7:id:1')!);
    await expect(cache.get('id:2')).rejects.toThrow();
  });

  it('refuses a record moved to another user', async () => {
    const store = memoryStore();
    const key = await sealingKey();
    await createPlaintextCache({ userId: 7, sealingKey: key, store }).put('id:1', 'mine');
    store.rows.set('8:id:1', store.rows.get('7:id:1')!);
    await expect(createPlaintextCache({ userId: 8, sealingKey: key, store }).get('id:1')).rejects.toThrow();
  });
});

describe('cacheKeyFor', () => {
  it('prefers the server ID and falls back to the client UUID', () => {
    expect(cacheKeyFor({ id: 9, client_uuid: 'abc' })).toBe('id:9');
    expect(cacheKeyFor({ client_uuid: 'abc' })).toBe('uuid:abc');
    expect(cacheKeyFor({})).toBeNull();
  });
});

describe('receiver decrypts each message once', () => {
  async function setup(options?: { slowFirst?: boolean }) {
    const store = memoryStore();
    const key = await sealingKey();
    const ratchet = fakeRatchet(options);
    const make = () => createReceiver({
      cache: createPlaintextCache({ userId: 7, sealingKey: key, store }),
      decrypt: ratchet.decrypt,
    });
    return { store, ratchet, make };
  }

  it('reuses the cached text instead of decrypting again', async () => {
    const { ratchet, make } = await setup();
    const receiver = make();
    await expect(receiver.receive(3, 'id:10', 'msg:1')).resolves.toBe('text 1 from 3');
    await expect(receiver.receive(3, 'id:10', 'msg:1')).resolves.toBe('text 1 from 3');
    expect(ratchet.decrypt).toHaveBeenCalledTimes(1);
  });

  it('shows the cached text after a reload, with a new receiver and no decryption', async () => {
    const { ratchet, make } = await setup();
    await make().receive(3, 'id:10', 'msg:1');
    const afterReload = make();
    await expect(afterReload.lookup('id:10')).resolves.toBe('text 1 from 3');
    await expect(afterReload.receive(3, 'id:10', 'msg:1')).resolves.toBe('text 1 from 3');
    expect(ratchet.decrypt).toHaveBeenCalledTimes(1);
  });

  it('shares one decryption between concurrent callers for the same message', async () => {
    const { ratchet, make } = await setup();
    const receiver = make();
    const [a, b] = await Promise.all([
      receiver.receive(3, 'id:10', 'msg:1'),
      receiver.receive(3, 'id:10', 'msg:1'),
    ]);
    expect(a).toBe(b);
    expect(ratchet.decrypt).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed decryption, so a later attempt can succeed', async () => {
    const store = memoryStore();
    const key = await sealingKey();
    const decrypt = vi.fn()
      .mockRejectedValueOnce(new Error('not ready'))
      .mockResolvedValueOnce('hello');
    const receiver = createReceiver({ cache: createPlaintextCache({ userId: 7, sealingKey: key, store }), decrypt });
    await expect(receiver.receive(3, 'id:5', 'c')).rejects.toThrow('not ready');
    await expect(receiver.lookup('id:5')).resolves.toBeNull();
    await expect(receiver.receive(3, 'id:5', 'c')).resolves.toBe('hello');
    expect(decrypt).toHaveBeenCalledTimes(2);
  });

  it('still returns the text when the cache write fails', async () => {
    const failing: SealedStore = {
      load: async () => null,
      save: async () => { throw new Error('quota exceeded'); },
    };
    const key = await sealingKey();
    const decrypt = vi.fn().mockResolvedValue('hello');
    const receiver = createReceiver({ cache: createPlaintextCache({ userId: 7, sealingKey: key, store: failing }), decrypt });
    await expect(receiver.receive(3, 'id:5', 'c')).resolves.toBe('hello');
  });

  it('stores the sender\'s own text so it can be read back', async () => {
    const { ratchet, make } = await setup();
    const receiver = make();
    await receiver.remember('id:77', 'my own words');
    await expect(make().lookup('id:77')).resolves.toBe('my own words');
    await expect(receiver.lookup(null)).resolves.toBeNull();
    expect(ratchet.decrypt).not.toHaveBeenCalled();
  });
});

describe('receive queue ordering', () => {
  it('runs tasks for one sender one at a time, in enqueue order', async () => {
    const enqueue = createReceiveQueue();
    const events: string[] = [];
    let running = 0;
    let maxRunning = 0;
    const task = (label: string, ms: number) => async () => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      events.push(`start ${label}`);
      await delay(ms);
      events.push(`end ${label}`);
      running -= 1;
      return label;
    };
    const results = await Promise.all([
      enqueue(1, task('a', 15)),
      enqueue(1, task('b', 1)),
      enqueue(1, task('c', 5)),
    ]);
    expect(results).toEqual(['a', 'b', 'c']);
    expect(maxRunning).toBe(1);
    expect(events).toEqual([
      'start a', 'end a', 'start b', 'end b', 'start c', 'end c',
    ]);
  });

  it('lets different senders run independently', async () => {
    const enqueue = createReceiveQueue();
    const finished: string[] = [];
    const slow = enqueue(1, async () => { await delay(20); finished.push('sender 1'); });
    const fast = enqueue(2, async () => { await delay(1); finished.push('sender 2'); });
    await Promise.all([slow, fast]);
    expect(finished).toEqual(['sender 2', 'sender 1']);
  });

  it('keeps a failed task from blocking the next one for the same sender', async () => {
    const enqueue = createReceiveQueue();
    const failed = enqueue(1, async () => { throw new Error('boom'); });
    const next = enqueue(1, async () => 'ok');
    await expect(failed).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('decrypts a sender\'s messages in order even when they are requested together', async () => {
    const store = memoryStore();
    const key = await sealingKey();
    const ratchet = fakeRatchet({ slowFirst: true });
    const receiver = createReceiver({
      cache: createPlaintextCache({ userId: 7, sealingKey: key, store }),
      decrypt: ratchet.decrypt,
    });
    const requests = [1, 2, 3, 4].map((n) => receiver.receive(3, `id:${n}`, `msg:${n}`));
    await expect(Promise.all(requests)).resolves.toEqual([
      'text 1 from 3', 'text 2 from 3', 'text 3 from 3', 'text 4 from 3',
    ]);
    expect(ratchet.decrypt.mock.calls.map(([, c]) => c)).toEqual(['msg:1', 'msg:2', 'msg:3', 'msg:4']);
  });

  it('keeps each sender\'s ratchet independent of the others', async () => {
    const store = memoryStore();
    const key = await sealingKey();
    const ratchet = fakeRatchet();
    const receiver = createReceiver({
      cache: createPlaintextCache({ userId: 7, sealingKey: key, store }),
      decrypt: ratchet.decrypt,
    });
    const results = await Promise.all([
      receiver.receive(3, 'id:1', 'msg:1'),
      receiver.receive(4, 'id:2', 'msg:1'),
      receiver.receive(3, 'id:3', 'msg:2'),
    ]);
    expect(results).toEqual(['text 1 from 3', 'text 1 from 4', 'text 2 from 3']);
  });
});
