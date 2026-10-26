/**
 * HTTP calls to the end-to-end encryption key directory. Only public keys cross
 * this boundary.
 */
import { authFetch } from '@/lib/api/authFetch';

export interface RegisterDeviceInput {
  device_uuid: string;
  registration_id: number;
  identity_key: string;
  signed_prekey_id: number;
  signed_prekey_public: string;
  signed_prekey_signature: string;
}

export interface OneTimePrekey {
  id: number;
  public_key: string;
}

/** Post-quantum (Kyber) prekey. The directory does not store one yet, so peers without it cannot start a session. */
export interface KyberPrekey {
  id: number;
  public_key: string;
  signature: string;
}

export interface DeviceBundle {
  device_uuid: string;
  registration_id: number;
  identity_key: string;
  signed_prekey: { id: number; public_key: string; signature: string };
  one_time_prekey: OneTimePrekey | null;
  kyber_prekey?: KyberPrekey | null;
}

export class DirectoryError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
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

export async function uploadPrekeys(deviceUuid: string, prekeys: OneTimePrekey[]): Promise<void> {
  await send(`/e2ee/devices/${encodeURIComponent(deviceUuid)}/prekeys`, {
    method: 'POST',
    body: JSON.stringify({
      prekeys: prekeys.map((prekey) => ({ key_id: prekey.id, public_key: prekey.public_key })),
    }),
  });
}

/** Every device of a user, each with one one-time prekey claimed for this request. */
export async function fetchBundles(userId: number): Promise<DeviceBundle[]> {
  const bundles = await send<DeviceBundle[] | null>(`/e2ee/users/${userId}/bundles`, { method: 'GET' });
  return Array.isArray(bundles) ? bundles : [];
}
