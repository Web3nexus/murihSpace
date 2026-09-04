<?php

namespace App\Services;

use App\Models\DeviceSession;
use App\Models\PendingLoginRequest;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DeviceSecurityService
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Determines whether the login attempt requires approval from an existing active device.
     */
    public function requiresDeviceApproval(User $user, Request $request): bool
    {
        try {
            $deviceId = $this->resolveDeviceId($request);

            // Check if there is an active trusted session for THIS exact device
            $existingThisDevice = DeviceSession::where('user_id', $user->id)
                ->where('device_id', $deviceId)
                ->whereNull('revoked_at')
                ->where('is_trusted', true)
                ->exists();

            if ($existingThisDevice) {
                return false;
            }

            // Count other active, valid sessions on other devices
            $activeOtherSessions = DeviceSession::where('user_id', $user->id)
                ->where('device_id', '!=', $deviceId)
                ->whereNull('revoked_at')
                ->where('is_trusted', true)
                ->where('last_active_at', '>=', now()->subDays(30))
                ->exists();

            return $activeOtherSessions;
        } catch (\Throwable $e) {
            report($e);
            return false;
        }
    }

    /**
     * Creates a pending login authorization request and notifies active trusted devices.
     */
    public function createPendingLoginRequest(User $user, Request $request): PendingLoginRequest
    {
        // Invalidate any older pending requests for this user
        try {
            PendingLoginRequest::where('user_id', $user->id)
                ->where('status', 'pending')
                ->update(['status' => 'cancelled']);
        } catch (\Throwable $e) {
            report($e);
        }

        $deviceId = $this->resolveDeviceId($request);
        $deviceName = $request->input('device_name') ?? $this->inferDeviceName($request);
        $platform = $request->input('platform') ?? $this->inferPlatform($request);

        $pending = PendingLoginRequest::create([
            'user_id' => $user->id,
            'request_token' => Str::random(64),
            'device_id' => $deviceId,
            'device_name' => $deviceName,
            'platform' => $platform,
            'ip' => $request->ip(),
            'location' => $request->input('location') ?? 'Unknown location',
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
        ]);

        // Send real-time notification to active devices
        try {
            $this->notifications->push(
                userId: $user->id,
                title: 'New Login Attempt',
                body: "A new {$platform} device ({$deviceName}) is attempting to log into your account.",
                data: [
                    'type' => 'new_device_login_request',
                    'request_id' => $pending->id,
                    'device_name' => $deviceName,
                    'platform' => $platform,
                    'ip' => $request->ip(),
                    'requested_at' => $pending->created_at->toIso8601String(),
                    'expires_at' => $pending->expires_at->toIso8601String(),
                ],
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return $pending;
    }

    /**
     * Approves a pending login request from an authenticated device.
     */
    public function approveLoginRequest(PendingLoginRequest $request, User $approvingUser, ?DeviceSession $approvingSession): string
    {
        if ($request->user_id !== $approvingUser->id) {
            throw new \InvalidArgumentException('Unauthorized approval.');
        }

        if (! $request->isPending()) {
            throw new \InvalidArgumentException('Login request has expired or is no longer pending.');
        }

        // Generate Sanctum token for the new device
        $expiration = (int) config('sanctum.expiration', 43200);
        $expiresAt = now()->addMinutes($expiration > 0 ? $expiration : 43200);
        $plainToken = $approvingUser->createToken('auth-token', ['*'], $expiresAt)->plainTextToken;

        // Create DeviceSession for new device
        $tokenRecord = $approvingUser->tokens()->where('token', hash('sha256', explode('|', $plainToken)[1] ?? $plainToken))->first();

        try {
            DeviceSession::create([
                'user_id' => $approvingUser->id,
                'device_id' => $request->device_id,
                'device_name' => $request->device_name,
                'platform' => $request->platform,
                'ip' => $request->ip,
                'personal_access_token_id' => $tokenRecord?->id,
                'is_trusted' => true,
                'last_active_at' => now(),
            ]);
        } catch (\Throwable $e) {
            report($e);
        }

        $request->update([
            'status' => 'approved',
            'approved_by_device_session_id' => $approvingSession?->id,
            'approved_at' => now(),
            'authorized_token' => encrypt($plainToken),
        ]);

        return $plainToken;
    }

    /**
     * Denies a pending login request.
     */
    public function denyLoginRequest(PendingLoginRequest $request, User $denyingUser): void
    {
        if ($request->user_id !== $denyingUser->id) {
            throw new \InvalidArgumentException('Unauthorized denial.');
        }

        $request->update([
            'status' => 'denied',
            'denied_at' => now(),
        ]);
    }

    /**
     * Registers or updates an active DeviceSession for an authenticated token.
     */
    public function registerActiveSession(User $user, Request $request, string $plainToken): ?DeviceSession
    {
        try {
            $deviceId = $this->resolveDeviceId($request);
            $deviceName = $request->input('device_name') ?? $this->inferDeviceName($request);
            $platform = $request->input('platform') ?? $this->inferPlatform($request);
            $tokenRecord = $user->tokens()->where('token', hash('sha256', explode('|', $plainToken)[1] ?? $plainToken))->first();

            return DeviceSession::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'device_id' => $deviceId,
                ],
                [
                    'device_name' => $deviceName,
                    'platform' => $platform,
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'personal_access_token_id' => $tokenRecord?->id,
                    'is_trusted' => true,
                    'last_active_at' => now(),
                    'revoked_at' => null,
                ]
            );
        } catch (\Throwable $e) {
            report($e);
            return null;
        }
    }

    public function resolveDeviceId(Request $request): string
    {
        $headerId = $request->header('X-Device-ID') ?? $request->input('device_id');
        if (! empty($headerId)) {
            return (string) $headerId;
        }

        // Fallback fingerprint: IP + User Agent hash
        return hash('sha256', ($request->ip() ?? 'unknown') . '|' . ($request->userAgent() ?? 'unknown'));
    }

    private function inferDeviceName(Request $request): string
    {
        $ua = $request->userAgent() ?? '';
        if (str_contains($ua, 'iPhone')) return 'iPhone';
        if (str_contains($ua, 'iPad')) return 'iPad';
        if (str_contains($ua, 'Android')) return 'Android Device';
        if (str_contains($ua, 'Macintosh')) return 'Mac';
        if (str_contains($ua, 'Windows')) return 'Windows PC';
        if (str_contains($ua, 'Linux')) return 'Linux PC';
        return 'Web Client';
    }

    private function inferPlatform(Request $request): string
    {
        $ua = strtolower($request->userAgent() ?? '');
        if (str_contains($ua, 'iphone') || str_contains($ua, 'ipad') || str_contains($ua, 'darwin')) return 'ios';
        if (str_contains($ua, 'android')) return 'android';
        if (str_contains($ua, 'macintosh')) return 'macos';
        if (str_contains($ua, 'windows')) return 'windows';
        return 'web';
    }
}
