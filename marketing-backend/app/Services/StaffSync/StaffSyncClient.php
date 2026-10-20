<?php

namespace App\Services\StaffSync;

use App\Models\StaffUser;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Pushes staff accounts to the main MurihSpace backend (identity hub).
 *
 *   POST {STAFF_SYNC_MAIN_URL}/internal/staff/sync     upsert one account
 *   POST {STAFF_SYNC_MAIN_URL}/internal/staff/disable  disable-only, by identity id
 *
 * Headers: X-Internal-Token, X-Timestamp (unix seconds), X-Nonce (16-128 chars).
 * Sync body: { staff_identity_id, email, name, role, status, permissions }
 * Disable body: { staff_identity_id }
 *
 * Any failure throws StaffSyncException so the queued job is retried.
 */
class StaffSyncClient
{
    public const SYNC_PATH = '/internal/staff/sync';

    public const DISABLE_PATH = '/internal/staff/disable';

    /**
     * @throws StaffSyncException
     */
    public function push(StaffUser $staff): void
    {
        $this->send(self::SYNC_PATH, self::payload($staff), 'Staff sync', $staff);
    }

    /**
     * Disable-only path. The main backend answers 404 when no account is linked
     * to this identity id (never synced, or already removed). That is not
     * retryable, so it returns false and the caller logs it.
     *
     * @throws StaffSyncException
     */
    public function disable(StaffUser $staff): bool
    {
        $response = $this->send(self::DISABLE_PATH, self::disablePayload($staff), 'Staff disable', $staff, [404]);

        return $response->status() !== 404;
    }

    /**
     * @return array{staff_identity_id:string, email:string, name:string, role:string, status:string, permissions:array<int, string>}
     *
     * @throws StaffSyncException
     */
    public static function payload(StaffUser $staff): array
    {
        try {
            $permissions = MainAdminMapping::permissions($staff->allPermissions());
            $role = MainAdminMapping::role($staff->role);
        } catch (\InvalidArgumentException $e) {
            throw new StaffSyncException($e->getMessage(), 0, $e);
        }

        if ($permissions === []) {
            throw new StaffSyncException('Staff '.$staff->id.' has no permissions to sync.');
        }

        return [
            'staff_identity_id' => (string) $staff->id,
            'email' => $staff->email,
            'name' => $staff->name,
            'role' => $role,
            'status' => $staff->status,
            'permissions' => $permissions,
        ];
    }

    /**
     * @return array{staff_identity_id:string}
     */
    public static function disablePayload(StaffUser $staff): array
    {
        return ['staff_identity_id' => (string) $staff->id];
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<int, int>  $acceptedFailures  HTTP statuses that are not errors
     *
     * @throws StaffSyncException
     */
    private function send(string $path, array $body, string $label, StaffUser $staff, array $acceptedFailures = []): Response
    {
        $base = rtrim((string) config('staff_sync.main_url'), '/');
        $token = (string) config('staff_sync.internal_token');

        if ($base === '' || $token === '') {
            throw new StaffSyncException('Staff sync is not configured.');
        }

        try {
            $response = $this->http()
                ->withHeaders([
                    'X-Internal-Token' => $token,
                    'X-Timestamp' => (string) time(),
                    'X-Nonce' => Str::random(40),
                ])
                ->post($base.$path, $body);
        } catch (ConnectionException $e) {
            throw new StaffSyncException($label.' connection failed: '.$e->getMessage(), 0, $e);
        }

        if (in_array($response->status(), $acceptedFailures, true)) {
            Log::info($label.' skipped: main backend has no account for staff.', [
                'staff_id' => $staff->id,
                'status' => $response->status(),
            ]);

            return $response;
        }

        if (! $response->successful()) {
            throw new StaffSyncException(
                $label.' rejected with HTTP '.$response->status().' for staff '.$staff->id.'.'
            );
        }

        return $response;
    }

    private function http(): PendingRequest
    {
        return Http::acceptJson()
            ->asJson()
            ->timeout((int) config('staff_sync.timeout', 10));
    }
}
