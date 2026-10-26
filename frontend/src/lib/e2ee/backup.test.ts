import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn(), put: vi.fn() },
}));

import { apiClient } from "@/lib/api/client";
import {
  BACKUP_VERSION,
  BackupError,
  PBKDF2_ITERATIONS,
  createBackup,
  decryptBackup,
  encryptBackup,
  restoreBackup,
  type BackupBlob,
} from "./backup";

const PASSPHRASE = "correct horse battery staple";
const DEVICE_JSON = JSON.stringify({ name: "alice", sessions: { bob: "state" }, identity: "secret" });

const put = vi.mocked(apiClient.put);
const get = vi.mocked(apiClient.get);

// PBKDF2 at 600k iterations takes a fraction of a second per derivation, so keep the count low.
const SLOW = 30_000;

describe("e2ee backup", () => {
  beforeEach(() => {
    put.mockReset();
    get.mockReset();
  });

  it(
    "round-trips the device export through encryptBackup and decryptBackup",
    async () => {
      const blob = await encryptBackup(PASSPHRASE, DEVICE_JSON);

      expect(blob.version).toBe(BACKUP_VERSION);
      expect(blob.iterations).toBe(PBKDF2_ITERATIONS);
      expect(blob.ciphertext).not.toContain("secret");
      expect(await decryptBackup(PASSPHRASE, blob)).toBe(DEVICE_JSON);
    },
    SLOW,
  );

  it(
    "uses a fresh salt and IV for every backup",
    async () => {
      const first = await encryptBackup(PASSPHRASE, DEVICE_JSON);
      const second = await encryptBackup(PASSPHRASE, DEVICE_JSON);

      expect(first.salt).not.toBe(second.salt);
      expect(first.iv).not.toBe(second.iv);
      expect(first.ciphertext).not.toBe(second.ciphertext);
    },
    SLOW,
  );

  it(
    "rejects a wrong passphrase",
    async () => {
      const blob = await encryptBackup(PASSPHRASE, DEVICE_JSON);

      await expect(decryptBackup("a different passphrase", blob)).rejects.toMatchObject({
        code: "wrong_passphrase",
      });
    },
    SLOW,
  );

  it(
    "rejects a tampered ciphertext",
    async () => {
      const blob = await encryptBackup(PASSPHRASE, DEVICE_JSON);
      const bytes = Uint8Array.from(atob(blob.ciphertext), (c) => c.charCodeAt(0));
      bytes[0] ^= 0xff;
      const tampered: BackupBlob = { ...blob, ciphertext: btoa(String.fromCharCode(...bytes)) };

      await expect(decryptBackup(PASSPHRASE, tampered)).rejects.toBeInstanceOf(BackupError);
    },
    SLOW,
  );

  it(
    "refuses a blob whose iteration count was lowered by the server",
    async () => {
      const blob = await encryptBackup(PASSPHRASE, DEVICE_JSON);

      await expect(decryptBackup(PASSPHRASE, { ...blob, iterations: 1000 })).rejects.toMatchObject({
        code: "invalid_backup",
      });
    },
    SLOW,
  );

  it("refuses a short passphrase before deriving a key", async () => {
    await expect(encryptBackup("short", DEVICE_JSON)).rejects.toMatchObject({
      code: "passphrase_too_short",
    });
  });

  it(
    "createBackup uploads only the ciphertext blob, never the plaintext",
    async () => {
      put.mockResolvedValue({ status: 200, data: {} } as never);

      await createBackup(PASSPHRASE, DEVICE_JSON);

      expect(put).toHaveBeenCalledTimes(1);
      const [path, body] = put.mock.calls[0];
      expect(path).toBe("/e2ee/backup");
      expect(Object.keys(body as object).sort()).toEqual(["ciphertext", "iterations", "iv", "salt", "version"]);
      expect(JSON.stringify(body)).not.toContain(PASSPHRASE);
      expect(JSON.stringify(body)).not.toContain("secret");
    },
    SLOW,
  );

  it(
    "restoreBackup returns the device export for a saved backup",
    async () => {
      const blob = await encryptBackup(PASSPHRASE, DEVICE_JSON);
      get.mockResolvedValue({ status: 200, data: { success: true, data: { data: blob } } } as never);

      expect(await restoreBackup(PASSPHRASE)).toBe(DEVICE_JSON);
    },
    SLOW,
  );

  it("restoreBackup returns null when there is no backup", async () => {
    get.mockResolvedValue({ status: 404, data: {} } as never);

    expect(await restoreBackup(PASSPHRASE)).toBeNull();
  });

  it(
    "round-trips through the upload and download functions",
    async () => {
      let stored: BackupBlob | null = null;
      put.mockImplementation(async (_path, body) => {
        stored = body as BackupBlob;
        return { status: 200, data: {} } as never;
      });
      get.mockImplementation(async () => ({
        status: 200,
        data: { success: true, data: { data: stored } },
      }) as never);

      await createBackup(PASSPHRASE, DEVICE_JSON);
      expect(await restoreBackup(PASSPHRASE)).toBe(DEVICE_JSON);
    },
    SLOW,
  );
});
