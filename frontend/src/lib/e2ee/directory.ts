/**
 * HTTP calls to the end-to-end encryption key directory. Only public keys cross
 * this boundary.
 */
import { authFetch } from '@/lib/api/authFetch';
import type { PublicBundleJson } from './bridge';

/** The server accepts at most this many one-time prekeys per upload request. */
export const MAX_PREKEYS_PER_UPLOAD = 100;

/** Body of POST /e2ee/devices: the device's public keys, including its Kyber prekey. */
export interface RegisterDeviceInput {
  device_uuid: string;
  registration_id: number;
  identity_key: string;
  signed_prekey_id: number;
  signed_prekey_public: string;
  signed_prekey_signature: string;
  kyber_prekey_id: number;
  kyber_prekey_public: string;
  kyber_prekey_signature: string;
}

export interface OneTimePrekey {
  id: number;
  public_key: string;
}

/**
 * One element of GET /e2ee/users/{user}/bundles: the flat public bundle of a device,
 * plus its UUID. Devices without Kyber keys are not listed.
 */
export type DeviceBundle = PublicBundleJson & { device_uuid: string };

export class DirectoryError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'DirectoryError';
  }
}

/** The API wraps payloads as { success, data: { data } }. Accept that shape and the plain ones. */
export function unwrapPayload<T>(body: unknown): T {
  let current: unknown = body;
  for (let depth = 0; depth < 2; depth += 1) {
    if (current && typeof current === 'object' && 'data' in current) {
      current = (current as { data: unknown }).data;
    } else {
      break;
    }
  }
  return current as T;
}

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const res = await authFetch(path, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new DirectoryError(body.message ?? `Key directory request failed (${res.status})`, res.status);
  }
  return unwrapPayload<T>(await res.json());
}

export async function registerDevice(input: RegisterDeviceInput): Promise<void> {
  await send('/e2ee/devices', { method: 'POST', body: JSON.stringify(input) });
}

/** Uploads one-time prekeys in batches of at most MAX_PREKEYS_PER_UPLOAD, in order. */
export async function uploadPrekeys(deviceUuid: string, prekeys: OneTimePrekey[]): Promise<void> {
  for (let start = 0; start < prekeys.length; start += MAX_PREKEYS_PER_UPLOAD) {
    const batch = prekeys.slice(start, start + MAX_PREKEYS_PER_UPLOAD);
    await send(`/e2ee/devices/${encodeURIComponent(deviceUuid)}/prekeys`, {
      method: 'POST',
      body: JSON.stringify({
        prekeys: batch.map((prekey) => ({ key_id: prekey.id, public_key: prekey.public_key })),
      }),
    });
  }
}

/** Every device of a user, each with one one-time prekey claimed for this request. */
export async function fetchBundles(userId: number): Promise<DeviceBundle[]> {
  const bundles = await send<DeviceBundle[] | null>(`/e2ee/users/${userId}/bundles`, { method: 'GET' });
  return Array.isArray(bundles) ? bundles : [];
}
