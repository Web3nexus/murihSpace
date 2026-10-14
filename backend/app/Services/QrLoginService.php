<?php

namespace App\Services;

use App\Models\DeviceSession;
use App\Models\QrLoginTransaction;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class QrLoginService
{
    /**
     * Max wrong confirmation-code guesses before the transaction is locked.
     */
    private const CONFIRMATION_MAX_ATTEMPTS = 5;

    /**
     * Start a new unauthenticated QR login transaction for the desktop.
     *
     * @return array{qr_token: string, poll_token: string, confirmation_code: string, expires_at: string, qr_deep_link: string, qr_url: string}
     */
    public function start(Request $request): array
    {
        $ttl = (int) config('murihspace.qr_login.ttl', 120);
        $expiresAt = now()->addSeconds($ttl);

        $qrToken = bin2hex(random_bytes(32));
        $pollToken = Str::random(64);

        // Short code shown only on this desktop. Kept out of the QR payload and
        // every other response so only someone with the desktop in view can
        // complete the pairing.
        $confirmationCode = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        $deviceId = $this->safeString($this->deviceId($request))
            ?? hash('sha256', ($request->ip() ?? 'unknown').'|'.($request->userAgent() ?? 'unknown'));

        // Reclaim orphaned pending transactions for this client so the table
        // does not accumulate. Only do this when the client actually supplied a
        // device identifier: the IP/UA fallback fingerprint can be shared by
        // unrelated users (e.g. behind a NAT/proxy) and must never cancel
        // another person's pending login.
        if ($this->clientProvidedDeviceId($request)) {
            try {
                QrLoginTransaction::where('status', 'pending')
                    ->where('ip', $request->ip())
                    ->where('device_id', $deviceId)
                    ->where('expires_at', '<=', now())
                    ->update(['status' => 'expired']);

                QrLoginTransaction::where('status', 'pending')
                    ->where('ip', $request->ip())
                    ->where('device_id', $deviceId)
                    ->update(['status' => 'cancelled']);
            } catch (\Throwable) {
                // Non-blocking; table will be cleaned up by expiry logic.
            }
        }

        $tx = QrLoginTransaction::create([
            'qr_token' => $qrToken,
            'poll_token_hash' => hash('sha256', $pollToken),
            'status' => 'pending',
            'device_id' => $deviceId,
            'device_name' => $this->safeString($request->input('device_name')) ?? $this->inferDeviceName($request),
            'platform' => $this->safeString($request->input('platform'), 50) ?? $this->inferPlatform($request),
            'ip' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'location' => $this->safeString($request->input('location'), 100) ?? 'Unknown location',
            'expires_at' => $expiresAt,
            'confirmation_code_hash' => hash('sha256', $confirmationCode),
        ]);

        $baseWeb = rtrim((string) config('murihspace.qr_login.web_url'), '/');

        return [
            'qr_token' => $tx->qr_token,
            'poll_token' => $pollToken,
            'confirmation_code' => $confirmationCode,
            'expires_at' => $tx->expires_at->toIso8601String(),
            'qr_deep_link' => "murihspace://qr-login?token={$tx->qr_token}",
            'qr_url' => "{$baseWeb}/qr-login?token={$tx->qr_token}",
        ];
    }

    /**
     * Poll by poll_token (desktop). Returns status; on approved returns token+user.
     */
    public function poll(string $pollToken): array
    {
        $tx = QrLoginTransaction::where('poll_token_hash', hash('sha256', $pollToken))->first();

        if (! $tx) {
            return ['status' => 'not_found'];
        }

        if ($tx->expires_at->isPast() && ! in_array($tx->status, ['approved', 'denied', 'consumed'])) {
            $tx->update(['status' => 'expired']);
        }

        if ($tx->status === 'approved') {
            // Decrypt BEFORE claiming so a corrupt payload does not silently
            // hand out a stored-but-unusable token.
            try {
                $plainToken = decrypt($tx->authorized_token);
            } catch (\Throwable) {
                QrLoginTransaction::where('id', $tx->id)
                    ->where('status', 'approved')
                    ->update([
                        'status' => 'consumed',
                        'authorized_token' => null,
                    ]);

                return ['status' => 'failed'];
            }

            // Deliver the token exactly once: atomically claim the transaction
            // by flipping approved -> consumed before handing out the secret.
            // Concurrent polls then see `consumed` instead of a second copy.
            $claimed = QrLoginTransaction::where('id', $tx->id)
                ->where('status', 'approved')
                ->update([
                    'status' => 'consumed',
                    'authorized_token' => null,
                ]);

            if ($claimed === 0) {
                return ['status' => 'consumed'];
            }

            return [
                'status' => 'approved',
                'token' => $plainToken,
                'user' => $this->serializeUser($tx->user),
            ];
        }

        if ($tx->status === 'denied') {
            return ['status' => 'denied'];
        }

        if ($tx->status === 'expired') {
            return ['status' => 'expired'];
        }

        if ($tx->status === 'consumed') {
            return ['status' => 'consumed'];
        }

        if ($tx->status === 'scanned') {
            return ['status' => 'scanned', 'scanned_at' => $tx->scanned_at?->toIso8601String()];
        }

        return ['status' => 'pending', 'expires_at' => $tx->expires_at->toIso8601String()];
    }

    /**
     * Mobile scans QR: claim/mark scanned for the given qr_token. Auth required.
     */
    public function scan(string $qrToken, User $scanningUser, Request $request): array
    {
        $tx = QrLoginTransaction::where('qr_token', $qrToken)->first();

        if (! $tx) {
            return ['status' => 'invalid'];
        }

        if ($tx->expires_at->isPast() && ! in_array($tx->status, ['approved', 'denied', 'consumed'])) {
            $tx->update(['status' => 'expired']);

            return ['status' => 'expired'];
        }

        // Claim the transaction atomically so two devices scanning at once
        // cannot both believe they own it. Only a still-pending row is updated.
        $claimed = QrLoginTransaction::where('id', $tx->id)
            ->where('status', 'pending')
            ->update([
                'status' => 'scanned',
                'user_id' => $scanningUser->id,
                'scanned_at' => now(),
            ]);

        if ($claimed === 0) {
            $current = $tx->fresh();

            // Re-scanning the same code on the same account: hand back the
            // claim data so the app can still reach the approve/deny step.
            if ($current->status === 'scanned' && $current->user_id === $scanningUser->id) {
                return $this->scanPayload($current);
            }

            // Someone else claimed it first — report their current state.
            return ['status' => $current->status];
        }

        return $this->scanPayload($tx->fresh());
    }

    /**
     * @return array{status: string, transaction_id: int, expires_at: string, device: array<string, mixed>}
     */
    private function scanPayload(QrLoginTransaction $tx): array
    {
        return [
            'status' => 'scanned',
            'transaction_id' => $tx->id,
            'expires_at' => $tx->expires_at->toIso8601String(),
            'device' => [
                'device_name' => $tx->device_name,
                'platform' => $tx->platform,
                'ip' => $tx->ip,
                'location' => $tx->location,
            ],
        ];
    }

    /**
     * Approve from mobile. Mints a session token for the DESKTOP and registers
     * a device session from the desktop's stored details — not the phone that
     * approved it. The desktop collects the token on its next poll.
     */
    public function approve(int $id, User $approvingUser, string $confirmationCode, ?DeviceSession $session = null): void
    {
        $tx = QrLoginTransaction::findOrFail($id);

        if ($tx->user_id !== $approvingUser->id) {
            throw new \InvalidArgumentException('Unauthorized.');
        }

        if (! $tx->isOpen()) {
            throw new \InvalidArgumentException('Transaction is no longer open.');
        }

        $this->assertConfirmationCode($tx, $confirmationCode);

        $expiration = (int) config('sanctum.expiration', 43200);
        $expiresAt = now()->addMinutes($expiration > 0 ? $expiration : 43200);

        $tokenRecord = null;

        // Claim and token creation share a transaction: claim the still-open
        // row FIRST, then mint the token only once we own it, and persist the
        // encrypted token on that same row. If anything fails the whole thing
        // rolls back, so a lost race never yields a usable session.
        DB::transaction(function () use ($tx, $approvingUser, $session, $expiresAt, &$tokenRecord): void {
            $claimed = QrLoginTransaction::where('id', $tx->id)
                ->where('user_id', $approvingUser->id)
                ->whereIn('status', ['pending', 'scanned'])
                ->where('expires_at', '>', now())
                ->where('confirmation_attempts', '<', self::CONFIRMATION_MAX_ATTEMPTS)
                ->update([
                    'status' => 'approved',
                    'approved_by_device_session_id' => $session?->id,
                    'approved_at' => now(),
                ]);

            if ($claimed === 0) {
                throw new \InvalidArgumentException('Transaction is no longer open.');
            }

            $newToken = $approvingUser->createToken('auth-token', ['*'], $expiresAt);
            $tokenRecord = $newToken->accessToken;

            QrLoginTransaction::where('id', $tx->id)
                ->update(['authorized_token' => encrypt($newToken->plainTextToken)]);
        });

        // Attribute the resulting session to the desktop that requested it, so
        // the user sees the browser (and its IP/platform) in their device list.
        try {
            DeviceSession::create([
                'user_id' => $approvingUser->id,
                'device_id' => $tx->device_id ?: $this->deviceId(request()),
                'device_name' => $tx->device_name,
                'platform' => $tx->platform,
                'ip' => $tx->ip,
                'user_agent' => $tx->user_agent,
                'personal_access_token_id' => $tokenRecord?->id,
                'is_trusted' => true,
                'last_active_at' => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }
    }

    /**
     * Deny from mobile.
     */
    public function deny(int $id, User $denyingUser): void
    {
        $tx = QrLoginTransaction::findOrFail($id);

        if ($tx->user_id !== $denyingUser->id) {
            throw new \InvalidArgumentException('Unauthorized.');
        }

        if (! $tx->isOpen()) {
            throw new \InvalidArgumentException('Transaction is no longer open.');
        }

        // Atomically claim so a concurrent approve cannot win after the deny.
        $claimed = QrLoginTransaction::where('id', $tx->id)
            ->where('user_id', $denyingUser->id)
            ->whereIn('status', ['pending', 'scanned'])
            ->where('expires_at', '>', now())
            ->update([
                'status' => 'denied',
                'denied_at' => now(),
            ]);

        if ($claimed === 0) {
            throw new \InvalidArgumentException('Transaction is no longer open.');
        }
    }

    /**
     * Verify the short confirmation code the phone read off the desktop. Locks
     * the transaction after a handful of wrong guesses so the 6-digit space
     * cannot be brute-forced within the (short) transaction TTL.
     */
    private function assertConfirmationCode(QrLoginTransaction $tx, string $code): void
    {
        $maxAttempts = self::CONFIRMATION_MAX_ATTEMPTS;
        $normalized = preg_replace('/\D/', '', $code) ?? '';

        $matches = $tx->confirmation_code_hash !== null
            && hash_equals($tx->confirmation_code_hash, hash('sha256', $normalized));

        if ($matches) {
            return;
        }

        // Increment atomically so concurrent wrong guesses cannot both read the
        // same stale count, then act on the persisted value.
        QrLoginTransaction::where('id', $tx->id)
            ->whereIn('status', ['pending', 'scanned'])
            ->increment('confirmation_attempts');

        $attempts = (int) QrLoginTransaction::where('id', $tx->id)->value('confirmation_attempts');

        if ($attempts >= $maxAttempts) {
            QrLoginTransaction::where('id', $tx->id)
                ->whereIn('status', ['pending', 'scanned'])
                ->update(['status' => 'denied', 'denied_at' => now()]);

            throw new \InvalidArgumentException('Too many incorrect confirmation codes.');
        }

        throw new \InvalidArgumentException('Incorrect confirmation code.');
    }

    /**
     * True when the request carries an explicit client-held device identifier
     * (header or body), as opposed to falling back to an IP/UA fingerprint that
     * may be shared across unrelated clients.
     */
    private function clientProvidedDeviceId(Request $request): bool
    {
        return ! empty($request->header('X-Device-ID'))
            || ! empty($request->input('device_id'));
    }

    /**
     * Trim/escape a client-supplied string and cap it to the destination column
     * length so it cannot overflow the row or inject markup into the approval
     * prompt shown on the phone.
     */
    private function safeString(mixed $value, int $max = 255): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $clean = trim(strip_tags($value));

        return $clean === '' ? null : Str::limit($clean, $max, '');
    }

    private function deviceId(Request $request): string
    {
        try {
            return app(DeviceSecurityService::class)->resolveDeviceId($request);
        } catch (\Throwable) {
            $headerId = $request->header('X-Device-ID') ?? $request->input('device_id');
            if (! empty($headerId)) {
                return (string) $headerId;
            }

            return hash('sha256', ($request->ip() ?? 'unknown').'|'.($request->userAgent() ?? 'unknown'));
        }
    }

    private function inferDeviceName(Request $request): string
    {
        $ua = $request->userAgent() ?? '';
        if (str_contains($ua, 'iPhone')) {
            return 'iPhone';
        }
        if (str_contains($ua, 'iPad')) {
            return 'iPad';
        }
        if (str_contains($ua, 'Android')) {
            return 'Android Device';
        }
        if (str_contains($ua, 'Macintosh')) {
            return 'Mac';
        }
        if (str_contains($ua, 'Windows')) {
            return 'Windows PC';
        }
        if (str_contains($ua, 'Linux')) {
            return 'Linux PC';
        }

        return 'Web Client';
    }

    private function inferPlatform(Request $request): string
    {
        $ua = strtolower($request->userAgent() ?? '');
        if (str_contains($ua, 'iphone') || str_contains($ua, 'ipad') || str_contains($ua, 'darwin')) {
            return 'ios';
        }
        if (str_contains($ua, 'android')) {
            return 'android';
        }
        if (str_contains($ua, 'macintosh')) {
            return 'macos';
        }
        if (str_contains($ua, 'windows')) {
            return 'windows';
        }

        return 'web';
    }

    private function serializeUser($user): array
    {
        if (! $user) {
            return [];
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'username' => $user->username,
            'role' => $user->role,
            'avatar_url' => $user->avatar_url ?? $user->avatar,
            'mobile_number' => $user->mobile_number,
            'coins' => $user->systemWallet?->available ?? 0,
            'created_at' => $user->created_at?->toISOString(),
        ];
    }
}
