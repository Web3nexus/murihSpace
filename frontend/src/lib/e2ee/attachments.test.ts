import { describe, expect, it } from 'vitest';
import { decryptAttachment, encryptAttachment } from './attachments';

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

describe('attachments e2ee', () => {
  it('round-trips binary content, mime, name and size', async () => {
    const original = new Uint8Array(4096);
    crypto.getRandomValues(original);
    const file = new File([original], 'voice-note.ogg', { type: 'audio/ogg' });

    const { ciphertext, metadata } = await encryptAttachment(file);
    const decrypted = await decryptAttachment(ciphertext, metadata);

    expect(metadata.name).toBe('voice-note.ogg');
    expect(metadata.mime).toBe('audio/ogg');
    expect(metadata.size).toBe(original.byteLength);
    expect(decrypted.type).toBe('audio/ogg');
    expect(decrypted.size).toBe(original.byteLength);
    expect(await bytesOf(decrypted)).toEqual(original);
  });

  it('never leaks plaintext into the ciphertext', async () => {
    const text = 'secret attachment body '.repeat(50);
    const file = new File([text], 'notes.txt', { type: 'text/plain' });

    const { ciphertext } = await encryptAttachment(file);
    const haystack = new TextDecoder('latin1').decode(ciphertext);

    expect(ciphertext.byteLength).toBe(text.length + 16); // GCM tag appended
    expect(haystack.includes('secret attachment body')).toBe(false);
  });

  it('uses a fresh key and nonce for every file', async () => {
    const file = new File(['same content'], 'a.txt', { type: 'text/plain' });

    const first = await encryptAttachment(file);
    const second = await encryptAttachment(file);

    expect(first.metadata.key).not.toBe(second.metadata.key);
    expect(first.metadata.iv).not.toBe(second.metadata.iv);
    expect(first.ciphertext).not.toEqual(second.ciphertext);
  });

  it('falls back to octet-stream when the file has no type', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'blob.bin');

    const { ciphertext, metadata } = await encryptAttachment(file);
    const decrypted = await decryptAttachment(ciphertext, metadata);

    expect(metadata.mime).toBe('application/octet-stream');
    expect(decrypted.type).toBe('application/octet-stream');
  });

  it('rejects ciphertext that was tampered with', async () => {
    const file = new File(['payload'], 'a.txt', { type: 'text/plain' });
    const { ciphertext, metadata } = await encryptAttachment(file);

    const tampered = new Uint8Array(ciphertext);
    tampered[0] ^= 0xff;

    await expect(decryptAttachment(tampered, metadata)).rejects.toThrow();
  });

  it('rejects a metadata key that does not match', async () => {
    const a = await encryptAttachment(new File(['one'], 'a.txt', { type: 'text/plain' }));
    const b = await encryptAttachment(new File(['two'], 'b.txt', { type: 'text/plain' }));

    await expect(
      decryptAttachment(a.ciphertext, { ...a.metadata, key: b.metadata.key }),
    ).rejects.toThrow();
  });

  it('rejects metadata whose size does not match the plaintext', async () => {
    const { ciphertext, metadata } = await encryptAttachment(
      new File(['hello'], 'a.txt', { type: 'text/plain' }),
    );

    await expect(decryptAttachment(ciphertext, { ...metadata, size: 999 })).rejects.toThrow(
      /size/,
    );
  });
});
