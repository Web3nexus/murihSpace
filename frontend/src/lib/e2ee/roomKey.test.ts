import { describe, expect, it } from 'vitest';
import {
  KEYRING_SIZE,
  MAX_GEN_CLOCK_SKEW_MS,
  ROOM_KEY_BYTES,
  RoomKeyManager,
  decodeRoomKeyMessage,
  encodeRoomKeyMessage,
  type E2eePeerTransport,
  type RoomKeyring,
} from './roomKey';

/** In-memory Signal stand-in: delivers bytes between identities in the same process. */
class Bus {
  private handlers = new Map<string, (peerId: string, bytes: Uint8Array) => void>();

  transportFor(identity: string): E2eePeerTransport {
    return {
      sendToPeer: async (peerId, bytes) => {
        const handler = this.handlers.get(peerId);
        if (handler) await Promise.resolve(handler(identity, bytes));
      },
      onFromPeer: (handler) => {
        this.handlers.set(identity, handler);
        return () => this.handlers.delete(identity);
      },
    };
  }
}

class FakeKeyring implements RoomKeyring {
  calls: Array<{ raw: Uint8Array; index: number }> = [];
  async setRoomKey(raw: Uint8Array, keyIndex: number): Promise<void> {
    this.calls.push({ raw, index: keyIndex });
  }
  get last() {
    return this.calls[this.calls.length - 1];
  }
}

function makeManager(
  bus: Bus,
  identity: string,
  opts: { canShareWith?: (id: string) => boolean; now?: () => number } = {},
) {
  const keyring = new FakeKeyring();
  const manager = new RoomKeyManager({
    roomId: 'room-1',
    transport: bus.transportFor(identity),
    keyring,
    localIdentity: identity,
    canShareWith: opts.canShareWith ?? (() => true),
    now: opts.now,
  });
  manager.start();
  return { manager, keyring };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('room key messages', () => {
  it('round-trips request and key messages', () => {
    const req = decodeRoomKeyMessage(encodeRoomKeyMessage({ v: 1, t: 'req', room: 'r' }));
    expect(req).toEqual({ v: 1, t: 'req', room: 'r' });

    const key = { v: 1 as const, t: 'key' as const, room: 'r', gen: 5, index: 5, key: 'AAAA' };
    expect(decodeRoomKeyMessage(encodeRoomKeyMessage(key))).toEqual(key);
  });

  it('rejects malformed input', () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(decodeRoomKeyMessage(enc('not json'))).toBeNull();
    expect(decodeRoomKeyMessage(enc('{"v":2,"t":"req","room":"r"}'))).toBeNull();
    expect(decodeRoomKeyMessage(enc('{"v":1,"t":"key","room":"r","gen":1,"index":99,"key":"AA"}'))).toBeNull();
    expect(decodeRoomKeyMessage(enc('{"v":1,"t":"key","room":"r","gen":1.5,"index":1,"key":"AA"}'))).toBeNull();
    expect(decodeRoomKeyMessage(enc('{"v":1,"t":"other","room":"r"}'))).toBeNull();
  });
});

describe('RoomKeyManager', () => {
  it('creates a 32-byte key and shares it with listed peers', async () => {
    const bus = new Bus();
    const host = makeManager(bus, 'host', { now: () => 1000 });
    const guest = makeManager(bus, 'guest');

    await host.manager.createAndShare(['guest']);
    await flush();

    expect(host.keyring.last.raw.length).toBe(ROOM_KEY_BYTES);
    expect(guest.keyring.last.raw).toEqual(host.keyring.last.raw);
    expect(guest.keyring.last.index).toBe(host.keyring.last.index);
    expect(guest.manager.hasKey).toBe(true);
    expect(guest.manager.currentGen).toBe(1000);
  });

  it('a joiner requests the key and a holder answers when allowed', async () => {
    const bus = new Bus();
    const host = makeManager(bus, 'host', { now: () => 2000 });
    await host.manager.createAndShare([]);

    const guest = makeManager(bus, 'guest');
    await guest.manager.requestFrom(['host']);
    await flush();

    expect(guest.manager.hasKey).toBe(true);
    expect(guest.keyring.last.raw).toEqual(host.keyring.last.raw);
  });

  it('a holder does not share with peers outside canShareWith', async () => {
    const bus = new Bus();
    const host = makeManager(bus, 'host', { canShareWith: () => false, now: () => 2000 });
    await host.manager.createAndShare([]);

    const outsider = makeManager(bus, 'outsider');
    await outsider.manager.requestFrom(['host']);
    await flush();

    expect(outsider.manager.hasKey).toBe(false);
    expect(outsider.keyring.calls.length).toBe(0);
  });

  it('ignores a key that is not newer than the one it holds', async () => {
    const bus = new Bus();
    const a = makeManager(bus, 'a', { now: () => 3000 });
    const b = makeManager(bus, 'b', { now: () => 1000 });
    await b.manager.createAndShare([]); // b holds gen 1000

    // a creates gen 3000 and sends it to b: newer, so accepted.
    await a.manager.createAndShare(['b']);
    await flush();
    const before = b.keyring.calls.length;
    expect(b.manager.currentGen).toBe(3000);

    // A stale message (gen 1000) must not replace it.
    const stale = encodeRoomKeyMessage({
      v: 1,
      t: 'key',
      room: 'room-1',
      gen: 1000,
      index: 1000 % KEYRING_SIZE,
      key: btoa('x'.repeat(ROOM_KEY_BYTES)),
    });
    await b.manager.handleFromPeer('c', stale);
    expect(b.keyring.calls.length).toBe(before);
    expect(b.manager.currentGen).toBe(3000);
  });

  it('ignores messages for another room', async () => {
    const bus = new Bus();
    const host = makeManager(bus, 'host', { now: () => 1000 });
    await host.manager.createAndShare([]);
    const other = makeManager(bus, 'other');
    await other.manager.handleFromPeer(
      'host',
      encodeRoomKeyMessage({ v: 1, t: 'req', room: 'some-other-room' }),
    );
    await flush();
    expect(other.manager.hasKey).toBe(false);
  });

  it('on leave, the lowest remaining identity rotates and the leaver gets no new key', async () => {
    const bus = new Bus();
    const alice = makeManager(bus, 'alice', { now: () => 1000 });
    const bob = makeManager(bus, 'bob');
    const carol = makeManager(bus, 'carol');
    await alice.manager.createAndShare(['bob', 'carol']);
    await flush();
    const oldKey = alice.keyring.last.raw;

    // Carol leaves. Alice (lowest identity) rotates and sends to Bob only.
    const aliceRotated = await alice.manager.onParticipantLeft(['bob']);
    await flush();
    expect(aliceRotated).toBe(true);
    expect(bob.keyring.last.raw).not.toEqual(oldKey);
    expect(bob.keyring.last.raw).toEqual(alice.keyring.last.raw);
    expect(carol.keyring.last.raw).toEqual(oldKey); // leaver keeps only the old key

    // Bob is not the rotator, so he does nothing on the same event.
    const bobRotated = await bob.manager.onParticipantLeft(['alice']);
    expect(bobRotated).toBe(false);
  });
});

describe('RoomKeyManager key acceptance', () => {
  const keyMessage = (gen: number) =>
    encodeRoomKeyMessage({
      v: 1,
      t: 'key',
      room: 'room-1',
      gen,
      index: gen % KEYRING_SIZE,
      key: btoa('k'.repeat(ROOM_KEY_BYTES)),
    });

  it('rejects a key from a peer that canShareWith does not allow', async () => {
    const receiver = makeManager(new Bus(), 'receiver', {
      canShareWith: (id) => id === 'trusted',
      now: () => 1000,
    });

    await receiver.manager.handleFromPeer('stranger', keyMessage(1000));

    expect(receiver.manager.hasKey).toBe(false);
    expect(receiver.keyring.calls).toHaveLength(0);
  });

  it('rejects a key whose generation is further ahead of the local clock than the skew limit', async () => {
    const now = 1_000_000;
    const receiver = makeManager(new Bus(), 'receiver', { now: () => now });

    await receiver.manager.handleFromPeer('trusted', keyMessage(now + MAX_GEN_CLOCK_SKEW_MS + 1));

    expect(receiver.manager.hasKey).toBe(false);
    expect(receiver.keyring.calls).toHaveLength(0);
  });

  it('accepts a key that is within the clock skew limit', async () => {
    const now = 1_000_000;
    const receiver = makeManager(new Bus(), 'receiver', { now: () => now });
    const gen = now + MAX_GEN_CLOCK_SKEW_MS;

    await receiver.manager.handleFromPeer('trusted', keyMessage(gen));

    expect(receiver.manager.hasKey).toBe(true);
    expect(receiver.manager.currentGen).toBe(gen);
  });

  it('accepts a valid newer key from an allowed peer', async () => {
    const receiver = makeManager(new Bus(), 'receiver', {
      canShareWith: (id) => id === 'trusted',
      now: () => 5000,
    });

    await receiver.manager.handleFromPeer('trusted', keyMessage(4000));

    expect(receiver.manager.hasKey).toBe(true);
    expect(receiver.manager.currentGen).toBe(4000);
    expect(receiver.keyring.last.raw).toHaveLength(ROOM_KEY_BYTES);
  });
});
