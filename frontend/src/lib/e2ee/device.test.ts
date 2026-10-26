import { beforeEach, describe, expect, it, vi } from 'vitest';
import { E2eeError, ensureDevice, receiveDecrypted, releaseDevice, sendEncrypted, base64ToBytes, bytesToBase64 } from './device';

// A stand-in for the WebAssembly bridge. It models only what device.ts relies on:
// per-name sessions, and a ciphertext that only the addressed device can open.
const bridgeState = vi.hoisted(() => ({ created: [] as FakeDevice[] }));

class FakeDevice {
  sessions = new Set<string>();
  constructor(readonly name: string, readonly registrationId: number, readonly prekeyCount: number) {
    bridgeState.created.push(this);
  }
  static restore(name: string, state: string): FakeDevice {
    const device = new FakeDevice(name, 0, 0);
    device.sessions = new Set((JSON.parse(state) as { sessions: string[] }).sessions);
    return device;
  }
  export(): string {
    return JSON.stringify({ sessions: [...this.sessions] });
  }
  publicBundle(): string {
    return JSON.stringify({
      registration_id: this.registrationId,
      device_id: 1,
      identity_key: 'aWRlbnRpdHk=',
      prekey_id: 1,
      prekey_public: 'cHJla2V5',
      signed_prekey_id: 1,
      signed_prekey_public: 'c2lnbmVk',
      signed_prekey_signature: 'c2ln',
      kyber_prekey_id: 1,
      kyber_prekey_public: 'a3liZXI=',
      kyber_prekey_signature: 'a3lzaWc=',
    });
  }
  startSession(remote: string, bundleJson: string): void {
    const bundle = JSON.parse(bundleJson) as { prekey_id: number };
    if (!bundle.prekey_id) throw new Error('missing prekey');
    this.sessions.add(remote);
  }
  // Ciphertext format for the fake: "<addressed device name>|<text>".
  encrypt(remote: string, plaintext: Uint8Array): Uint8Array {
    if (!this.sessions.has(remote)) throw new Error('no session');
    return new TextEncoder().encode(`${remote}|${new TextDecoder().decode(plaintext)}`);
  }
  decrypt(remote: string, data: Uint8Array): Uint8Array {
    const [target, ...rest] = new TextDecoder().decode(data).split('|');
    if (target !== this.name) throw new Error('not addressed to this device');
    this.sessions.add(remote);
    return new TextEncoder().encode(rest.join('|'));
  }
  free(): void {
    /* nothing to release in the fake */
  }
}

vi.mock('./bridge', () => ({
  Device: FakeDevice,
  loadBridge: async () => undefined,
}));

const directory = vi.hoisted(() => ({
  registerDevice: vi.fn(async (_input: unknown) => undefined),
  uploadPrekeys: vi.fn(async (_uuid: string, _prekeys: unknown) => undefined),
  fetchBundles: vi.fn(async (_userId: number) => [] as unknown[]),
}));
vi.mock('./directory', () => directory);

// In-memory replacement for the IndexedDB + WebCrypto vault.
type Sealed = { iv: Uint8Array; ciphertext: Uint8Array };
const vaultStore = vi.hoisted(() => new Map<number, Sealed>());
vi.mock('./vault', () => ({
  getWrapKey: async () => ({}) as CryptoKey,
  loadSealedDevice: async (userId: number) => vaultStore.get(userId) ?? null,
  saveSealedDevice: async (userId: number, sealed: Sealed) => {
    vaultStore.set(userId, sealed);
  },
  seal: async (_key: unknown, _userId: number, value: unknown) => ({
    iv: new Uint8Array(12),
    ciphertext: new TextEncoder().encode(JSON.stringify(value)),
  }),
  open: async (_key: unknown, _userId: number, sealed: Sealed) =>
    JSON.parse(new TextDecoder().decode(sealed.ciphertext)),
}));

function peerBundle(overrides: Record<string, unknown> = {}) {
  return {
    device_uuid: 'peer-device',
    registration_id: 99,
    identity_key: 'aWRlbnRpdHk=',
    signed_prekey: { id: 1, public_key: 'c2lnbmVk', signature: 'c2ln' },
    one_time_prekey: { id: 5, public_key: 'b25lLXRpbWU=' },
    kyber_prekey: { id: 1, public_key: 'a3liZXI=', signature: 'a3lzaWc=' },
    ...overrides,
  };
}

function text(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

describe('e2ee device service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vaultStore.clear();
    bridgeState.created.length = 0;
    await releaseDevice();
  });

  it('creates a device on first sign-in and publishes its public keys', async () => {
    await ensureDevice(1);

    expect(directory.registerDevice).toHaveBeenCalledTimes(1);
    expect(directory.registerDevice.mock.calls[0][0]).toMatchObject({
      identity_key: 'aWRlbnRpdHk=',
      signed_prekey_id: 1,
    });
    expect(directory.uploadPrekeys).toHaveBeenCalledWith(expect.any(String), [{ id: 1, public_key: 'cHJla2V5' }]);
    expect(vaultStore.has(1)).toBe(true);
  });

  it('restores the sealed device on later sign-ins instead of registering a new one', async () => {
    await ensureDevice(1);
    await releaseDevice();
    vi.clearAllMocks();

    await ensureDevice(1);

    expect(bridgeState.created).toHaveLength(2);
    expect(bridgeState.created[1].name).toBe('user:1');
    expect(directory.registerDevice).not.toHaveBeenCalled();
  });

  it('starts a session once, then reuses it for later messages', async () => {
    directory.fetchBundles.mockResolvedValueOnce([peerBundle()]);
    await ensureDevice(1);

    const first = await sendEncrypted(2, 'hello');
    const second = await sendEncrypted(2, 'again');

    expect(directory.fetchBundles).toHaveBeenCalledTimes(1);
    expect(directory.fetchBundles).toHaveBeenCalledWith(2);
    expect(text(base64ToBytes(first))).toBe('user:2|hello');
    expect(text(base64ToBytes(second))).toBe('user:2|again');
  });

  it('delivers text from one device to another through the ciphertext', async () => {
    directory.fetchBundles.mockResolvedValueOnce([peerBundle()]);
    await ensureDevice(1);
    const ciphertext = await sendEncrypted(2, 'secret text');

    await ensureDevice(2);
    await expect(receiveDecrypted(1, ciphertext)).resolves.toBe('secret text');
  });

  it('decodes base64 without changing the bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('fails clearly when the recipient has no post-quantum key, instead of sending plaintext', async () => {
    directory.fetchBundles.mockResolvedValueOnce([peerBundle({ kyber_prekey: undefined })]);
    await ensureDevice(1);

    await expect(sendEncrypted(2, 'hello')).rejects.toMatchObject({ code: 'PEER_NEEDS_PQ_KEY' });
  });

  it('fails when the recipient has no device or no one-time key left', async () => {
    await ensureDevice(1);

    directory.fetchBundles.mockResolvedValueOnce([]);
    await expect(sendEncrypted(2, 'hi')).rejects.toBeInstanceOf(E2eeError);

    directory.fetchBundles.mockResolvedValueOnce([peerBundle({ one_time_prekey: null })]);
    await expect(sendEncrypted(3, 'hi')).rejects.toMatchObject({ code: 'PEER_HAS_NO_PREKEY' });
  });

  it('refuses to encrypt before a device exists', async () => {
    await expect(sendEncrypted(2, 'hi')).rejects.toMatchObject({ code: 'NOT_READY' });
  });
});
