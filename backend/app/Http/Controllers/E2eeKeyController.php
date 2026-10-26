<?php

namespace App\Http\Controllers;

use App\Models\E2eeDevice;
use App\Models\E2eeOneTimePrekey;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Public key directory for end-to-end encryption.
 *
 * The server stores and hands out public keys only. Each device registers its
 * identity key and signed prekey, uploads one-time prekeys, and other users
 * fetch a bundle to start an encrypted session. Each one-time prekey is handed
 * out once. Signature checks and the session itself happen on the device.
 */
class E2eeKeyController extends Controller
{
    private const MAX_PREKEYS_PER_UPLOAD = 100;

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_uuid' => ['required', 'string', 'max:64'],
            'registration_id' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'identity_key' => ['required', 'string', 'max:256'],
            'signed_prekey_id' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'signed_prekey_public' => ['required', 'string', 'max:256'],
            'signed_prekey_signature' => ['required', 'string', 'max:256'],
        ]);

        $device = E2eeDevice::updateOrCreate(
            ['user_id' => $request->user()->id, 'device_uuid' => $validated['device_uuid']],
            $validated + ['last_seen_at' => now()],
        );

        return response()->json(['data' => ['device_uuid' => $device->device_uuid]], 201);
    }

    public function uploadPrekeys(Request $request, string $deviceUuid): JsonResponse
    {
        $device = $this->ownDevice($request, $deviceUuid);

        $validated = $request->validate([
            'prekeys' => ['required', 'array', 'min:1', 'max:'.self::MAX_PREKEYS_PER_UPLOAD],
            'prekeys.*.key_id' => ['required', 'integer', 'min:0', 'max:2147483647'],
            'prekeys.*.public_key' => ['required', 'string', 'max:256'],
        ]);

        $now = now();
        $rows = collect($validated['prekeys'])->map(fn (array $prekey) => [
            'e2ee_device_id' => $device->id,
            'key_id' => $prekey['key_id'],
            'public_key' => $prekey['public_key'],
            'claimed_at' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        // Existing key ids are kept as they are, so a key that was already
        // handed out can't be swapped for a different one.
        E2eeOneTimePrekey::insertOrIgnore($rows);

        return response()->json([
            'data' => [
                'device_uuid' => $device->device_uuid,
                'available' => $device->oneTimePrekeys()->whereNull('claimed_at')->count(),
            ],
        ]);
    }

    public function bundles(User $user): JsonResponse
    {
        $bundles = E2eeDevice::where('user_id', $user->id)
            ->orderBy('id')
            ->get()
            ->map(fn (E2eeDevice $device) => [
                'device_uuid' => $device->device_uuid,
                'registration_id' => $device->registration_id,
                'identity_key' => $device->identity_key,
                'signed_prekey' => [
                    'id' => $device->signed_prekey_id,
                    'public_key' => $device->signed_prekey_public,
                    'signature' => $device->signed_prekey_signature,
                ],
                'one_time_prekey' => $this->claimOneTimePrekey($device),
            ])
            ->values();

        return response()->json(['data' => $bundles]);
    }

    private function claimOneTimePrekey(E2eeDevice $device): ?array
    {
        return DB::transaction(function () use ($device) {
            $prekey = E2eeOneTimePrekey::where('e2ee_device_id', $device->id)
                ->whereNull('claimed_at')
                ->orderBy('key_id')
                ->lockForUpdate()
                ->first();

            if (! $prekey) {
                return null;
            }

            $prekey->update(['claimed_at' => now()]);

            return ['id' => $prekey->key_id, 'public_key' => $prekey->public_key];
        });
    }

    private function ownDevice(Request $request, string $deviceUuid): E2eeDevice
    {
        return E2eeDevice::where('user_id', $request->user()->id)
            ->where('device_uuid', $deviceUuid)
            ->firstOrFail();
    }
}
