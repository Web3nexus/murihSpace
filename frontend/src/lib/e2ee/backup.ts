/**
 * Encrypted key backup for end-to-end encryption.
 *
 * The device state (the JSON from the bridge's Device.export()) is encrypted in the
 * browser with AES-256-GCM. The key comes from the user's passphrase through
 * PBKDF2-HMAC-SHA256 with a random salt. Only the ciphertext, salt, IV, iteration
 * count and format version go to the server. The server never sees the passphrase
 * or the plaintext.
 *
 * Losing the passphrase makes the backup unrecoverable. There is no reset path by
 * design. See docs/e2ee-backup.md.
 *
 * Interface for the web integration:
 *   - createBackup(passphrase, deviceExportJson): encrypts and uploads the backup.
 *   - restoreBackup(passphrase): downloads and decrypts it. Returns the device JSON
 *     for Device.restore(), or null when no backup exists.
 */
import { apiClient } from "@/lib/api/client";

/** Format version of the backup blob. Bump it when the layout or key derivation changes. */
export const BACKUP_VERSION = 1;

/** Iterations used for new backups. Matches the server minimum. */
export const PBKDF2_ITERATIONS = 600_000;

/** Lowest iteration count accepted when reading. A server must not be able to lower it. */
const MIN_ACCEPTED_ITERATIONS = 600_000;
const MAX_ACCEPTED_ITERATIONS = 10_000_000;

const SALT_BYTES = 16;
const IV_BYTES = 12;
const MIN_PASSPHRASE_CHARS = 12;

const BACKUP_PATH = "/e2ee/backup";

/** The blob stored on the server. Field names match the backend validation. */
export interface BackupBlob {
  version: number;
  salt: string;
  iv: string;
  iterations: number;
  ciphertext: string;
}

export type BackupErrorCode =
  | "passphrase_too_short"
  | "wrong_passphrase"
  | "unsupported_version"
  | "invalid_backup";

export class BackupError extends Error {
  readonly code: BackupErrorCode;

  constructor(code: BackupErrorCode, message: string) {
    super(message);
    this.name = "BackupError";
    this.code = code;
  }
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function normalizePassphrase(passphrase: string): string {
  return passphrase.normalize("NFKC");
}

function assertPassphrase(passphrase: string): string {
  const normalized = normalizePassphrase(passphrase);
  if ([...normalized].length < MIN_PASSPHRASE_CHARS) {
    throw new BackupError(
      "passphrase_too_short",
      `The backup passphrase must be at least ${MIN_PASSPHRASE_CHARS} characters.`,
    );
  }
  return normalized;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new BackupError("invalid_backup", "The backup contains invalid base64.");
  }
}

/** Copies TextEncoder output into a buffer typed as a plain ArrayBuffer, which WebCrypto requires. */
function utf8(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(encoder.encode(text));
}

/** Binds the format version and iteration count to the ciphertext, so neither can be changed unnoticed. */
function additionalData(version: number, iterations: number): Uint8Array<ArrayBuffer> {
  return utf8(`muri-e2ee-backup|v${version}|i${iterations}`);
}

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    utf8(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypts the device export with a key derived from the passphrase. Pure: no network. */
export async function encryptBackup(passphrase: string, plaintext: string): Promise<BackupBlob> {
  const normalized = assertPassphrase(passphrase);
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(SALT_BYTES)));
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_BYTES)));
  const key = await deriveKey(normalized, salt, PBKDF2_ITERATIONS);

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: additionalData(BACKUP_VERSION, PBKDF2_ITERATIONS),
    },
    key,
    utf8(plaintext),
  );

  return {
    version: BACKUP_VERSION,
    salt: toBase64(salt),
    iv: toBase64(iv),
    iterations: PBKDF2_ITERATIONS,
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };
}

/** Decrypts a backup blob. Throws BackupError when the passphrase is wrong or the blob is altered. */
export async function decryptBackup(passphrase: string, blob: BackupBlob): Promise<string> {
  const normalized = assertPassphrase(passphrase);

  if (blob.version !== BACKUP_VERSION) {
    throw new BackupError("unsupported_version", `Unsupported backup version ${blob.version}.`);
  }
  if (
    !Number.isInteger(blob.iterations) ||
    blob.iterations < MIN_ACCEPTED_ITERATIONS ||
    blob.iterations > MAX_ACCEPTED_ITERATIONS
  ) {
    throw new BackupError("invalid_backup", "The backup uses an iteration count that is not accepted.");
  }

  const salt = fromBase64(blob.salt);
  const iv = fromBase64(blob.iv);
  const data = fromBase64(blob.ciphertext);
  if (salt.length < SALT_BYTES || iv.length !== IV_BYTES) {
    throw new BackupError("invalid_backup", "The backup has an invalid salt or IV.");
  }

  const key = await deriveKey(normalized, salt, blob.iterations);
  try {
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: additionalData(blob.version, blob.iterations),
      },
      key,
      data,
    );
    return decoder.decode(plaintext);
  } catch {
    // AES-GCM authentication fails for both a wrong passphrase and a tampered blob.
    throw new BackupError("wrong_passphrase", "The passphrase is wrong or the backup is damaged.");
  }
}

/**
 * Encrypts the device export and uploads it, replacing any previous backup.
 * deviceExportJson is the string from the bridge's Device.export().
 */
export async function createBackup(passphrase: string, deviceExportJson: string): Promise<BackupBlob> {
  const blob = await encryptBackup(passphrase, deviceExportJson);
  await apiClient.put(BACKUP_PATH, blob);
  return blob;
}

/**
 * Downloads and decrypts the backup. Returns the device export JSON for Device.restore(),
 * or null when the user has no backup. Throws BackupError on a wrong passphrase.
 */
export async function restoreBackup(passphrase: string): Promise<string | null> {
  const response = await apiClient.get(BACKUP_PATH, { validateStatus: (status) => status === 200 || status === 404 });
  if (response.status === 404) {
    return null;
  }

  const blob = extractBlob(response.data);
  return decryptBackup(passphrase, blob);
}

/** The API envelope nests the payload under data (and sometimes data.data). Find the blob. */
function extractBlob(body: unknown): BackupBlob {
  const candidates = [
    (body as { data?: { data?: unknown } } | undefined)?.data?.data,
    (body as { data?: unknown } | undefined)?.data,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && "ciphertext" in candidate) {
      return candidate as BackupBlob;
    }
  }
  throw new BackupError("invalid_backup", "The server returned an unexpected backup response.");
}
