<?php

namespace App\Services;

use App\Models\StaffUser;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Client\ConnectionException;

/**
 * Member enforcement, requested from the main backend.
 *
 * The main backend is the system of record for member standing (DEC-011). This
 * service is therefore a client, not an owner: it sends a request, and the
 * response carries the authoritative state. Nothing here writes a local copy of
 * whether a member is warned or banned, because a second writable copy is
 * exactly the thing DEC-011 exists to prevent.
 *
 * Two behaviours are worth stating explicitly because callers depend on them:
 *
 *  - `ban()` returns a failure carrying `warning_required` when the member has
 *    no active warning. That is the gate working, not an error to retry, so it
 *    is returned as a structured result rather than thrown.
 *  - Every call is best-effort in the sense that a transport failure returns a
 *    failure; it never reports success it cannot verify.
 */
class MemberEnforcementService
{
    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed> ['ok' => bool, ...]
     */
    public function warn(StaffUser $staff, int $userId, string $reason, array $extra = []): array
    {
        return $this->post('/internal/enforcement/warn', $staff, array_merge([
            'user_id' => $userId,
            'reason' => $reason,
        ], $extra));
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed> ['ok' => bool, ...]
     */
    public function ban(StaffUser $staff, int $userId, string $reason, array $extra = []): array
    {
        return $this->post('/internal/enforcement/ban', $staff, array_merge([
            'user_id' => $userId,
            'reason' => $reason,
        ], $extra));
    }

    /**
     * @param  array<string, mixed>  $extra
     * @return array<string, mixed>
     */
    public function flagReport(StaffUser $staff, int $reportId, ?string $note = null): array
    {
        return $this->post('/internal/enforcement/flag-report', $staff, [
            'report_id' => $reportId,
            'flag_note' => $note,
        ]);
    }

    /**
     * The member's current standing, as the main backend sees it.
     *
     * @return array<string, mixed>|null
     */
    public function memberStanding(int $userId): ?array
    {
        return $this->get("/internal/support/users/{$userId}/summary");
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function post(string $path, StaffUser $staff, array $payload): array
    {
        $token = (string) config('services.main_backend.token');

        if (! $token) {
            return $this->failure('The main backend is not configured, so enforcement is unavailable.');
        }

        try {
            $response = Http::baseUrl((string) config('services.main_backend.base_url'))
                ->withHeaders($this->signingHeaders($token))
                ->timeout(10)
                ->post($path, array_merge($payload, ['actor_email' => $staff->email]));
        } catch (ConnectionException $e) {
            Log::warning('Member enforcement request could not reach the main backend.', [
                'path' => $path,
                'staff_id' => $staff->id,
            ]);

            return $this->failure('The main backend could not be reached. Nothing was changed.');
        }

        $body = $response->json();

        if (! is_array($body)) {
            return $this->failure('The main backend returned an unreadable response.');
        }

        if ($response->successful() && ($body['success'] ?? false) === true) {
            return array_merge(['ok' => true], (array) ($body['data'] ?? []));
        }

        // Surface the main backend's refusal verbatim. In particular the warning
        // gate arrives as code `warning_required`, and the caller needs that
        // distinction to tell the operator to warn first rather than to retry.
        $code = $body['errors']['code'] ?? null;

        return [
            'ok' => false,
            'code' => $code,
            'message' => $body['message'] ?? 'The main backend refused the request.',
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function get(string $path): ?array
    {
        $token = (string) config('services.main_backend.token');

        if (! $token) {
            return null;
        }

        try {
            $response = Http::baseUrl((string) config('services.main_backend.base_url'))
                ->withHeaders($this->signingHeaders($token))
                ->timeout(10)
                ->get($path);
        } catch (ConnectionException) {
            return null;
        }

        $body = $response->json();

        return is_array($body) ? $body : null;
    }

    /**
     * @return array<string, string>
     */
    private function signingHeaders(string $token): array
    {
        return [
            'X-Internal-Token' => $token,
            'X-Timestamp' => (string) now()->getTimestamp(),
            'X-Nonce' => bin2hex(random_bytes(16)),
            'Accept' => 'application/json',
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function failure(string $message): array
    {
        return ['ok' => false, 'message' => $message];
    }
}
