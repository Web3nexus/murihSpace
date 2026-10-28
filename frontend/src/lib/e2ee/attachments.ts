/**
 * Client-side encryption for chat attachments (photos, videos, voice notes, files).
 *
 * - A fresh AES-256-GCM key and 96-bit nonce are generated for every file.
 * - Only the ciphertext is uploaded; the server never sees the key.
 * - `metadata` is meant to be sent to the recipient inside the existing
 *   1:1 Signal session, never in the upload request.
 */

/** Reads a Blob's bytes. FileReader is the fallback for environments whose File lacks arrayBuffer (jsdom). */
function readBytes(blob: Blob): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer().then((buffer) => new Uint8Array(buffer));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export interface AttachmentKeyMetadata {
  /** Base64 of the raw 256-bit AES key. */
  key: string;
  /** Base64 of the 12-byte GCM nonce. */
  iv: string;
  /** MIME type of the original plaintext file. */
  mime: string;
  /** Original file name. */
  name: string;
  /** Size of the original plaintext in bytes. */
  size: number;
}

export interface EncryptedAttachment {
  /** AES-GCM output: ciphertext with the 16-byte auth tag appended. */
  ciphertext: Uint8Array<ArrayBuffer>;
  metadata: AttachmentKeyMetadata;
}

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BITS = 128;
const DEFAULT_MIME = 'application/octet-stream';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function copyBytes(bytes: Uint8Array | ArrayBuffer): Uint8Array<ArrayBuffer> {
  const source = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  const out = new Uint8Array(new ArrayBuffer(source.byteLength));
  out.set(source);
  return out;
}

/**
 * Encrypt a file for upload. The returned `ciphertext` is what gets sent to
 * the server; `metadata` must be delivered to the recipient over Signal.
 */
export async function encryptAttachment(
  file: Blob,
  options: { name?: string } = {},
): Promise<EncryptedAttachment> {
  const name = options.name ?? (file instanceof File ? file.name : 'attachment');
  const mime = file.type || DEFAULT_MIME;

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(IV_BYTES)));
  const plaintext = await readBytes(file);

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_BITS },
    key,
    plaintext,
  );
  const rawKey = new Uint8Array(await crypto.subtle.exportKey('raw', key));

  return {
    ciphertext: new Uint8Array(encrypted),
    metadata: {
      key: toBase64(rawKey),
      iv: toBase64(iv),
      mime,
      name,
      size: plaintext.byteLength,
    },
  };
}

/**
 * Decrypt downloaded ciphertext using the metadata received over Signal.
 * Throws if the key, nonce or tag is wrong, or if the decrypted size does not
 * match the size recorded in the metadata.
 */
export async function decryptAttachment(
  bytes: ArrayBuffer | Uint8Array,
  metadata: AttachmentKeyMetadata,
): Promise<Blob> {
  const rawKey = fromBase64(metadata.key);
  const iv = fromBase64(metadata.iv);
  if (rawKey.byteLength !== KEY_BYTES) throw new Error('Invalid attachment key length.');
  if (iv.byteLength !== IV_BYTES) throw new Error('Invalid attachment nonce length.');

  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: TAG_BITS },
      key,
      copyBytes(bytes),
    ),
  );

  if (plaintext.byteLength !== metadata.size) {
    throw new Error('Decrypted attachment size does not match metadata.');
  }

  return new Blob([plaintext], { type: metadata.mime || DEFAULT_MIME });
}
