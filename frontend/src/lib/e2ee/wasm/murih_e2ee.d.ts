/* tslint:disable */
/* eslint-disable */

/**
 * One device's keys and sessions. Private keys stay inside this object, and are
 * exported only as JSON that the browser encrypts before storing.
 */
export class Device {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Creates (once) this device's sender key for a group and returns the distribution
     * envelope to encrypt to each other member with `encrypt`. Send it only over the
     * 1:1 session, never in the clear.
     */
    createSenderKeyDistribution(group_id: string): Uint8Array;
    /**
     * Decrypts a message received from a remote device.
     */
    decrypt(remote_name: string, data: Uint8Array): Uint8Array;
    /**
     * Encrypts a message for a remote device. The result starts with a type tag.
     */
    encrypt(remote_name: string, plaintext: Uint8Array): Uint8Array;
    /**
     * Everything this device must keep: keys and sessions, as JSON. The caller
     * must encrypt this before storing it anywhere.
     */
    export(): string;
    /**
     * Creates `count` one-time prekeys, stores their private parts, and returns the public
     * parts as a JSON array of `{ "key_id", "public_key" }`, ready for the upload endpoint
     * (which accepts at most 100 per request). Ids never collide with earlier ones.
     */
    generatePrekeys(count: number): string;
    /**
     * Decrypts a group message from `sender_name`. Refuses any message whose key the
     * sender did not announce for this group, so a key from another group cannot be used.
     */
    groupDecrypt(sender_name: string, group_id: string, data: Uint8Array): Uint8Array;
    /**
     * Encrypts one plaintext for a group, once, with this device's sender key.
     */
    groupEncrypt(group_id: string, plaintext: Uint8Array): Uint8Array;
    /**
     * Creates a device with fresh identity, signed, Kyber and one-time prekeys.
     */
    constructor(name: string, registration_id: number, prekey_count: number);
    /**
     * Number of one-time prekeys this device created.
     */
    prekeyCount(): number;
    /**
     * Stores a sender key received from `sender_name` (the plaintext of a 1:1 message
     * that carried a distribution envelope), so their group messages can be read.
     */
    processSenderKeyDistribution(sender_name: string, data: Uint8Array): void;
    /**
     * The public keys to upload to the key directory, as JSON.
     */
    publicBundle(): string;
    /**
     * Restores a device from the JSON produced by `export`.
     */
    static restore(name: string, state_json: string): Device;
    /**
     * Discards this device's sender key for a group. The next `createSenderKeyDistribution`
     * starts a new chain, which members who were removed never receive. Call it when
     * membership changes, before redistributing.
     */
    rotateSenderKey(group_id: string): void;
    /**
     * Starts an encrypted session with another device, from its public bundle. The bundle
     * may carry no one-time prekey (`one_time_prekey` null or absent).
     */
    startSession(remote_name: string, remote_bundle_json: string): void;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_device_free: (a: number, b: number) => void;
    readonly device_createSenderKeyDistribution: (a: number, b: number, c: number) => [number, number, number, number];
    readonly device_decrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly device_encrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly device_export: (a: number) => [number, number, number, number];
    readonly device_generatePrekeys: (a: number, b: number) => [number, number, number, number];
    readonly device_groupDecrypt: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly device_groupEncrypt: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly device_new: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly device_prekeyCount: (a: number) => number;
    readonly device_processSenderKeyDistribution: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly device_publicBundle: (a: number) => [number, number, number, number];
    readonly device_restore: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly device_rotateSenderKey: (a: number, b: number, c: number) => [number, number];
    readonly device_startSession: (a: number, b: number, c: number, d: number, e: number) => [number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
