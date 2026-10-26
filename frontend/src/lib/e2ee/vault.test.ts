import { describe, expect, it } from 'vitest';
import { open, seal } from './vault';

async function sealingKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

describe('vault sealing', () => {
  it('round-trips a value for the same user', async () => {
    const key = await sealingKey();
    const sealed = await seal(key, 7, { state: 'private keys', sessionPeers: [3] });
    await expect(open(key, 7, sealed)).resolves.toEqual({ state: 'private keys', sessionPeers: [3] });
  });

  it('does not contain the plaintext', async () => {
    const key = await sealingKey();
    const sealed = await seal(key, 7, { state: 'super-secret-state-marker' });
    const raw = new TextDecoder().decode(sealed.ciphertext);
    expect(raw).not.toContain('super-secret-state-marker');
  });

  it('refuses a record moved to another user', async () => {
    const key = await sealingKey();
    const sealed = await seal(key, 7, { state: 'x' });
    await expect(open(key, 8, sealed)).rejects.toThrow();
  });

  it('refuses altered ciphertext', async () => {
    const key = await sealingKey();
    const sealed = await seal(key, 7, { state: 'x' });
    sealed.ciphertext[0] ^= 0x01;
    await expect(open(key, 7, sealed)).rejects.toThrow();
  });

  it('uses a key that cannot be exported', async () => {
    const key = await sealingKey();
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });
});
