/**
 * Browser-side storage for this device's end-to-end encryption state.
 *
 * The state (private keys and ratchet sessions) is sealed with AES-GCM before it
 * reaches IndexedDB. The wrapping key is a non-extractable CryptoKey, so script
 * can use it but never read its raw bytes. The user ID is bound as additional
 * data, so a sealed record cannot be moved into another account's slot.
 */

const DB_NAME = 'murihspace-e2ee';
const DB_VERSION = 2;
const WRAP_STORE = 'wrap';
const DEVICE_STORE = 'devices';
const MESSAGE_STORE = 'messages';
const WRAP_KEY_ID = 'v1';

export interface SealedRecord {
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(WRAP_STORE)) db.createObjectStore(WRAP_STORE, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(DEVICE_STORE)) db.createObjectStore(DEVICE_STORE, { keyPath: 'userId' });
        if (!db.objectStoreNames.contains(MESSAGE_STORE)) db.createObjectStore(MESSAGE_STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
  }
  return dbPromise;
}

async function getRecord<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function putRecord(store: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

let wrapKeyPromise: Promise<CryptoKey> | null = null;

/** The browser's sealing key. Created once and stored as a non-extractable CryptoKey. */
export function getWrapKey(): Promise<CryptoKey> {
  if (!wrapKeyPromise) {
    wrapKeyPromise = (async () => {
      const existing = await getRecord<{ id: string; key: CryptoKey }>(WRAP_STORE, WRAP_KEY_ID);
      if (existing?.key) return existing.key;
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
      await putRecord(WRAP_STORE, { id: WRAP_KEY_ID, key });
      return key;
    })().catch((error: unknown) => {
      wrapKeyPromise = null;
      throw error;
    });
  }
  return wrapKeyPromise;
}

function additionalData(userId: number): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(`murihspace-e2ee:v1:${userId}`);
}

/** Seals a JSON-serialisable value for one user. */
export async function seal(key: CryptoKey, userId: number, value: unknown): Promise<SealedRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(value));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: additionalData(userId) },
    key,
    plaintext,
  );
  return { iv, ciphertext: new Uint8Array(ciphertext) };
}

/** Opens a record made by `seal`. Throws if it was altered or belongs to another user. */
export async function open<T>(key: CryptoKey, userId: number, sealed: SealedRecord): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.iv, additionalData: additionalData(userId) },
    key,
    sealed.ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}

export async function loadSealedDevice(userId: number): Promise<SealedRecord | null> {
  const row = await getRecord<{ userId: number } & SealedRecord>(DEVICE_STORE, userId);
  return row ? { iv: row.iv, ciphertext: row.ciphertext } : null;
}

export async function saveSealedDevice(userId: number, sealed: SealedRecord): Promise<void> {
  await putRecord(DEVICE_STORE, { userId, iv: sealed.iv, ciphertext: sealed.ciphertext });
}

/** Reads one sealed plaintext-cache record. The key must already name one user's entry. */
export async function loadSealedMessage(storeKey: string): Promise<SealedRecord | null> {
  const row = await getRecord<{ key: string } & SealedRecord>(MESSAGE_STORE, storeKey);
  return row ? { iv: row.iv, ciphertext: row.ciphertext } : null;
}

export async function saveSealedMessage(storeKey: string, sealed: SealedRecord): Promise<void> {
  await putRecord(MESSAGE_STORE, { key: storeKey, iv: sealed.iv, ciphertext: sealed.ciphertext });
}
