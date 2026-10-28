/**
 * This browser's end-to-end encryption device: creation on sign-in, restore on
 * later visits, and encrypt / decrypt for direct messages.
 *
 * One device per signed-in user per browser. Every operation runs one at a time,
 * because each one moves the ratchet forward and must be saved before the next.
 * Across browser tabs, operations also hold an exclusive Web Lock per user, and
 * each one re-reads the sealed device first, because another tab may have moved
 * the ratchet forward since this tab last saved it.
 */
import { Device, loadBridge, type GeneratedPrekeyJson, type PublicBundleJson } from './bridge';
import { fetchBundles, registerDevice, uploadPrekeys, type DeviceBundle } from './directory';
import { getWrapKey, loadSealedDevice, open, saveSealedDevice, seal } from './vault';

const STATE_VERSION = 1;
/** One-time prekeys generated per upload batch. */
const PREKEY_BATCH_SIZE = 20;
/** Upload more when the server reports fewer unclaimed one-time prekeys than this. */
const PREKEY_LOW_WATER = 5;
/** Caps the top-up batches in one pass, so a server that ignores uploads cannot loop forever. */
const MAX_PREKEY_TOP_UP_BATCHES = 3;

export type E2eeErrorCode = 'NOT_READY' | 'PEER_HAS_NO_DEVICE' | 'PEER_HAS_NO_PREKEY' | 'PEER_NEEDS_PQ_KEY';

export class E2eeError extends Error {
  readonly code: E2eeErrorCode;

  constructor(code: E2eeErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'E2eeError';
  }
}

interface StoredDevice {
  v: number;
  deviceUuid: string;
  registered: boolean;
  /** The bridge's export: private keys and sessions. Never stored unsealed. */
  state: string;
  /** Peers this device already has a session with, by user ID. */
  sessionPeers: number[];
}

interface ActiveDevice {
  userId: number;
  deviceUuid: string;
  registered: boolean;
  device: Device;
  sessionPeers: Set<number>;
}

let active: ActiveDevice | null = null;
let queue: Promise<void> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Web Lock name for one user's device. Shared by every tab of this browser. */
const lockNameFor = (userId: number): string => `murihspace-e2ee-device:${userId}`;

/**
 * Runs a task while holding this user's exclusive lock across all tabs.
 * Falls back to the in-tab queue only when navigator.locks is unavailable
 * (older browsers). In that case two tabs can interleave their device operations,
 * so the sealed state may be stale; the caller's reload step is the only guard.
 */
function withUserLock<T>(userId: number, task: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(lockNameFor(userId), { mode: 'exclusive' }, task);
  }
  // Fallback: navigator.locks is missing, so only the in-tab queue (serialize) applies.
  return task();
}

/** Protocol name of a user's device. The bridge addresses sessions by this name. */
const nameFor = (userId: number): string => `user:${userId}`;

function randomRegistrationId(): number {
  const [value] = crypto.getRandomValues(new Uint32Array(1));
  return 1 + (value % 16380);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function persist(s: ActiveDevice): Promise<void> {
  const key = await getWrapKey();
  const stored: StoredDevice = {
    v: STATE_VERSION,
    deviceUuid: s.deviceUuid,
    registered: s.registered,
    state: s.device.export(),
    sessionPeers: [...s.sessionPeers],
  };
  await saveSealedDevice(s.userId, await seal(key, s.userId, stored));
}

/**
 * Registers this device's public keys with the key directory, then generates and
 * uploads its one-time prekeys. The private parts are saved before any public part
 * leaves the browser, so the directory never holds a key this device cannot use.
 */
async function publish(s: ActiveDevice): Promise<void> {
  const bundle = JSON.parse(s.device.publicBundle()) as PublicBundleJson;
  await registerDevice({
    device_uuid: s.deviceUuid,
    registration_id: bundle.registration_id,
    identity_key: bundle.identity_key,
    signed_prekey_id: bundle.signed_prekey_id,
    signed_prekey_public: bundle.signed_prekey_public,
    signed_prekey_signature: bundle.signed_prekey_signature,
    kyber_prekey_id: bundle.kyber_prekey_id,
    kyber_prekey_public: bundle.kyber_prekey_public,
    kyber_prekey_signature: bundle.kyber_prekey_signature,
  });
  const available = await uploadPrekeyBatch(s);
  await topUpPrekeys(s, available);
  s.registered = true;
}

/**
 * Generates one batch of one-time prekeys, saves their private parts, uploads the
 * public parts, and returns the unclaimed count the server reports afterwards.
 */
async function uploadPrekeyBatch(s: ActiveDevice): Promise<number> {
  const generated = JSON.parse(s.device.generatePrekeys(PREKEY_BATCH_SIZE)) as GeneratedPrekeyJson[];
  await persist(s);
  return uploadPrekeys(
    s.deviceUuid,
    generated.map((prekey) => ({ id: prekey.key_id, public_key: prekey.public_key })),
  );
}

/**
 * Uploads more one-time prekeys while the server's reported count is below the low-water mark.
 */
async function topUpPrekeys(s: ActiveDevice, available: number): Promise<void> {
  let count = available;
  for (let batch = 0; count < PREKEY_LOW_WATER && batch < MAX_PREKEY_TOP_UP_BATCHES; batch += 1) {
    count = await uploadPrekeyBatch(s);
  }
}

function requireActive(): ActiveDevice {
  if (!active || !active.registered) {
    throw new E2eeError('NOT_READY', 'End-to-end encryption is not ready for this session.');
  }
  return active;
}

/** Reads this user's sealed device from storage, or null when none exists yet. */
async function loadFromStorage(userId: number): Promise<ActiveDevice | null> {
  const sealed = await loadSealedDevice(userId);
  if (!sealed) return null;
  const key = await getWrapKey();
  const stored = await open<StoredDevice>(key, userId, sealed);
  return {
    userId,
    deviceUuid: stored.deviceUuid,
    registered: stored.registered,
    device: Device.restore(nameFor(userId), stored.state),
    sessionPeers: new Set(stored.sessionPeers),
  };
}

function replaceActive(next: ActiveDevice): void {
  const previous = active;
  active = next;
  if (previous && previous !== next) previous.device.free();
}

/**
 * Re-reads the sealed device so this tab works on the newest ratchet state, then
 * checks it is ready for this user. Call only while holding the user's lock.
 */
async function reloadReady(userId: number): Promise<ActiveDevice> {
  await loadBridge();
  const stored = await loadFromStorage(userId);
  if (stored) replaceActive(stored);
  const s = requireActive();
  if (s.userId !== userId) {
    throw new E2eeError('NOT_READY', 'End-to-end encryption is not ready for this session.');
  }
  return s;
}

/**
 * Creates or restores this browser's device for a signed-in user, and makes sure
 * its public keys are in the key directory. Call it on sign-in.
 * Initialization runs under the user's lock, so two tabs cannot both create a device.
 */
export function ensureDevice(userId: number): Promise<void> {
  return serialize(() => withUserLock(userId, async () => {
    await loadBridge();
    const stored = await loadFromStorage(userId);
    if (stored) {
      replaceActive(stored);
    } else if (active?.userId !== userId) {
      const fresh: ActiveDevice = {
        userId,
        deviceUuid: crypto.randomUUID(),
        registered: false,
        // The bridge's constructor makes no one-time prekeys: publish() generates and uploads them.
        device: new Device(nameFor(userId), randomRegistrationId(), 0),
        sessionPeers: new Set(),
      };
      await persist(fresh);
      replaceActive(fresh);
    }

    const current = active;
    if (current && !current.registered) {
      await publish(current);
      await persist(current);
    }
  }));
}

/** Drops the in-memory device on sign-out. The sealed copy stays in IndexedDB. */
export function releaseDevice(): Promise<void> {
  return serialize(async () => {
    active?.device.free();
    active = null;
  });
}

/**
 * Maps one directory bundle to the JSON the bridge expects, with the one-time prekey
 * claimed for this session. The directory uses the bridge's field names, so only the
 * one-time prekey is swapped in.
 */
function toPeerBundle(bundle: DeviceBundle, oneTime: DeviceBundle['one_time_prekey']): PublicBundleJson {
  if (!bundle.kyber_prekey_public) {
    throw new E2eeError('PEER_NEEDS_PQ_KEY', 'The recipient has no post-quantum key in the directory yet.');
  }
  return {
    registration_id: bundle.registration_id,
    identity_key: bundle.identity_key,
    signed_prekey_id: bundle.signed_prekey_id,
    signed_prekey_public: bundle.signed_prekey_public,
    signed_prekey_signature: bundle.signed_prekey_signature,
    kyber_prekey_id: bundle.kyber_prekey_id,
    kyber_prekey_public: bundle.kyber_prekey_public,
    kyber_prekey_signature: bundle.kyber_prekey_signature,
    one_time_prekey: oneTime,
  };
}

async function startSession(s: ActiveDevice, peerUserId: number): Promise<void> {
  const bundles = await fetchBundles(peerUserId);
  if (bundles.length === 0) {
    throw new E2eeError('PEER_HAS_NO_DEVICE', 'The recipient has no encryption device yet.');
  }
  // The newest device is the one the recipient is most likely using now. Prefer the newest
  // device that still has a one-time prekey; otherwise use the newest device without one.
  const newestFirst = [...bundles].reverse();
  const target = newestFirst.find((bundle) => bundle.one_time_prekey) ?? newestFirst[0];
  s.device.startSession(nameFor(peerUserId), JSON.stringify(toPeerBundle(target, target.one_time_prekey)));
  s.sessionPeers.add(peerUserId);
}

/**
 * Encrypts text for another user. Returns base64 ciphertext for the server.
 * Throws instead of falling back to plaintext when no session can be made.
 */
export function sendEncrypted(peerUserId: number, text: string): Promise<string> {
  return serialize(async () => {
    const userId = requireActive().userId;
    return withUserLock(userId, async () => {
      const s = await reloadReady(userId);
      if (!s.sessionPeers.has(peerUserId)) {
        await startSession(s, peerUserId);
      }
      const bytes = s.device.encrypt(nameFor(peerUserId), new TextEncoder().encode(text));
      await persist(s);
      return bytesToBase64(bytes);
    });
  });
}

/** Decrypts base64 ciphertext received from another user. */
export function receiveDecrypted(senderUserId: number, ciphertext: string): Promise<string> {
  return serialize(async () => {
    const userId = requireActive().userId;
    return withUserLock(userId, async () => {
      const s = await reloadReady(userId);
      const plaintext = s.device.decrypt(nameFor(senderUserId), base64ToBytes(ciphertext));
      s.sessionPeers.add(senderUserId);
      await persist(s);
      return new TextDecoder().decode(plaintext);
    });
  });
}
