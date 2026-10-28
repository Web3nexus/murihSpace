/**
 * Room key distribution for end-to-end encrypted calls and livestreams.
 *
 * One random 256-bit key protects a whole room. It travels only between
 * devices, inside each pair's existing Signal session (see `E2eePeerTransport`).
 * The MurihSpace server never sees the key, so it cannot decrypt media.
 *
 * Protocol (JSON, sent as bytes over the peer transport):
 * - `req`: a participant without a key asks the others for it.
 * - `key`: a key holder sends `{ gen, index, key }` to one peer.
 *
 * `gen` is a millisecond timestamp that only grows, so a receiver accepts a key
 * only if it is newer than the one it has. `index` (gen mod 16) is the LiveKit
 * keyring slot that the frames carry.
 *
 * Rotation: when a participant leaves, the lowest identity still present
 * generates a fresh key and sends it to everyone who remains. The leaver never
 * receives it, so they cannot decrypt later media.
 */

export const ROOM_KEY_BYTES = 32;
export const KEYRING_SIZE = 16;

export interface E2eePeerTransport {
  /** Sends bytes to one peer over the existing 1:1 Signal session. */
  sendToPeer(peerId: string, bytes: Uint8Array): Promise<void>;
  /** Registers a handler for bytes from peers. Returns an unsubscribe function. */
  onFromPeer(handler: (peerId: string, bytes: Uint8Array) => void): () => void;
}

/** The part of LiveKit's key provider that the manager needs. */
export interface RoomKeyring {
  setRoomKey(raw: Uint8Array, keyIndex: number): Promise<void>;
}

export type RoomKeyMessage =
  | { v: 1; t: 'req'; room: string }
  | { v: 1; t: 'key'; room: string; gen: number; index: number; key: string };

export function createRoomKey(): Uint8Array {
  const bytes = new Uint8Array(ROOM_KEY_BYTES);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeRoomKeyMessage(message: RoomKeyMessage): Uint8Array {
  return encoder.encode(JSON.stringify(message));
}

/** Returns null for anything that is not a well-formed room key message. */
export function decodeRoomKeyMessage(bytes: Uint8Array): RoomKeyMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(bytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const m = parsed as Record<string, unknown>;
  if (m.v !== 1 || typeof m.room !== 'string') return null;
  if (m.t === 'req') return { v: 1, t: 'req', room: m.room };
  if (
    m.t === 'key' &&
    typeof m.gen === 'number' &&
    Number.isSafeInteger(m.gen) &&
    typeof m.index === 'number' &&
    Number.isInteger(m.index) &&
    m.index >= 0 &&
    m.index < KEYRING_SIZE &&
    typeof m.key === 'string'
  ) {
    return { v: 1, t: 'key', room: m.room, gen: m.gen, index: m.index, key: m.key };
  }
  return null;
}

export interface RoomKeyManagerOptions {
  roomId: string;
  transport: E2eePeerTransport;
  keyring: RoomKeyring;
  /** Decides whether this device may hand the key to a peer. Default: never. */
  canShareWith?: (peerId: string) => boolean;
  /** This device's LiveKit identity. Used to decide whether it is the rotator. */
  localIdentity: string;
  now?: () => number;
}

/**
 * Holds this device's view of the room key and moves it between peers.
 * It does not touch LiveKit directly; the keyring adapter does that.
 */
export class RoomKeyManager {
  private gen = 0;
  private lastIndex = 0;
  private key: Uint8Array | null = null;
  private readonly opts: RoomKeyManagerOptions;
  private unsubscribe: (() => void) | null = null;

  constructor(opts: RoomKeyManagerOptions) {
    this.opts = opts;
  }

  get hasKey(): boolean {
    return this.key !== null;
  }

  get currentGen(): number {
    return this.gen;
  }

  /** Starts listening for peer messages. Call once per room session. */
  start(): void {
    this.unsubscribe = this.opts.transport.onFromPeer((peerId, bytes) => {
      void this.handleFromPeer(peerId, bytes);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /** Creates a new room key (initiator) and gives it to every listed peer. */
  async createAndShare(peers: string[]): Promise<void> {
    await this.install(createRoomKey(), this.nextGen());
    await Promise.all(peers.map((p) => this.sendKey(p)));
  }

  /** Asks every listed peer for the key. Holders answer if they are allowed to share. */
  async requestFrom(peers: string[]): Promise<void> {
    if (this.hasKey) return;
    const msg = encodeRoomKeyMessage({ v: 1, t: 'req', room: this.opts.roomId });
    await Promise.all(peers.map((p) => this.opts.transport.sendToPeer(p, msg)));
  }

  /**
   * Called when a participant left. If this device is the rotator, it creates a
   * fresh key and sends it to everyone still present. Returns true when it rotated.
   */
  async onParticipantLeft(remaining: string[]): Promise<boolean> {
    const present = [this.opts.localIdentity, ...remaining].filter(
      (id, i, all) => all.indexOf(id) === i,
    );
    const rotator = [...present].sort()[0];
    if (rotator !== this.opts.localIdentity) return false;
    await this.install(createRoomKey(), this.nextGen());
    await Promise.all(remaining.map((p) => this.sendKey(p)));
    return true;
  }

  /** Handles one message from a peer. Exposed for tests. */
  async handleFromPeer(peerId: string, bytes: Uint8Array): Promise<void> {
    const msg = decodeRoomKeyMessage(bytes);
    if (!msg || msg.room !== this.opts.roomId) return;

    if (msg.t === 'req') {
      if (this.key && this.opts.canShareWith?.(peerId)) {
        await this.sendKey(peerId);
      }
      return;
    }

    // Accept a key only when it is newer than ours. Stale or replayed keys are ignored.
    if (msg.gen <= this.gen) return;
    const raw = fromBase64(msg.key);
    if (raw.length !== ROOM_KEY_BYTES) return;
    await this.install(raw, msg.gen, msg.index);
  }

  private nextGen(): number {
    const now = (this.opts.now ?? Date.now)();
    return Math.max(now, this.gen + 1);
  }

  private async install(raw: Uint8Array, gen: number, index?: number): Promise<void> {
    const slot = index ?? gen % KEYRING_SIZE;
    await this.opts.keyring.setRoomKey(raw, slot);
    this.key = raw;
    this.gen = gen;
    this.lastIndex = slot;
  }

  private async sendKey(peerId: string): Promise<void> {
    if (!this.key) return;
    const msg = encodeRoomKeyMessage({
      v: 1,
      t: 'key',
      room: this.opts.roomId,
      gen: this.gen,
      index: this.lastIndex,
      key: toBase64(this.key),
    });
    await this.opts.transport.sendToPeer(peerId, msg);
  }
}
