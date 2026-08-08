<?php

namespace App\Services\Kyc;

use App\Enums\KycStatus;
use App\Jobs\ProcessKycWebhook;
use App\Models\KycVerification;
use App\Models\KycWebhookEvent;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\AdminAlertService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class KycService
{
    public function __construct(
        private readonly KycProviderManager $providers,
        private readonly NotificationService $notifications,
    ) {}

    public function providerName(): string
    {
        return $this->providers->activeProviderName();
    }

    public function providerEnabled(): bool
    {
        return $this->providers->enabledProviders() !== [];
    }

    /**
     * Enabled automated providers (didit/sumsub) — manual review is the
     * fallback UX and is intentionally excluded from this list.
     *
     * @return array<string, bool>
     */
    public function enabledProviders(): array
    {
        $result = [];

        foreach ($this->providers->enabledProviders() as $name => $provider) {
            if ($name === 'manual') {
                continue;
            }

            $result[$name] = $provider->isEnabled();
        }

        return $result;
    }

    /**
     * Build the user-facing KYC status payload.
     */
    public function status(User $user): array
    {
        $verification = $this->latestFor($user);
        $status = $verification?->status ?? $user->kyc_status ?? KycStatus::Unsubmitted->value;

        return [
            'kyc_status' => $status,
            'kyc_provider' => $verification?->provider ?? $user->kyc_provider ?? $this->providerName(),
            'verification_id' => $verification?->id,
            'kyc_rejection_reason' => $verification?->rejection_reason ?? $user->kyc_rejection_reason,
            'providers' => $this->enabledProviders(),
            'provider_enabled' => $this->providerEnabled(),
            'required_for_sellers' => (bool) config('kyc.required_for_sellers', true),
        ];
    }

    /**
     * Start a new verification session via a specific (or the active) provider.
     *
     * @return array{session: ?KycSessionResult, verification: ?KycVerification}
     */
    public function startSession(User $user, ?string $providerName = null): array
    {
        $provider = $providerName !== null ? $this->providers->provider($providerName) : $this->providers->active();

        if (! $provider->isEnabled()) {
            return ['session' => new KycSessionResult(success: false, message: 'Automated verification is not configured.'), 'verification' => null];
        }

        if ($user->kyc_status === KycStatus::Verified->value) {
            return ['session' => new KycSessionResult(success: false, message: 'You are already verified.'), 'verification' => $this->latestFor($user)];
        }

        $result = $provider->createSession($user);

        if (! $result->success) {
            return ['session' => $result, 'verification' => null];
        }

        $verification = $this->createVerification(
            user: $user,
            provider: $provider->name(),
            sessionId: $result->sessionId,
        );

        $user->update([
            'kyc_provider' => $provider->name(),
            'kyc_status' => KycStatus::Pending->value,
            'kyc_rejection_reason' => null,
            'kyc_verification_id' => $verification->id,
        ]);

        app(AdminAlertService::class)->dispatch([
            'event_type' => 'kyc_submission',
            'severity' => 'warning',
            'title' => 'New KYC Submission',
            'description' => "User {$user->name} has started a new identity verification via {$provider->name()}.",
            'reference' => env('APP_URL') . '/app/securegate/kyc?status=pending',
            'channels' => ['email', 'telegram']
        ]);

        return ['session' => $result, 'verification' => $verification];
    }

    public function latestFor(User $user): ?KycVerification
    {
        if ($user->kyc_verification_id !== null) {
            $linked = KycVerification::find($user->kyc_verification_id);
            if ($linked !== null) {
                return $linked;
            }
        }

        return $user->kycVerifications()->latest('id')->first();
    }

    public function history(User $user): array
    {
        return $user->kycVerifications()
            ->orderByDesc('id')
            ->get()
            ->map(fn (KycVerification $v) => [
                'id' => $v->id,
                'provider' => $v->provider,
                'status' => $v->status,
                'started_at' => $v->started_at?->toISOString(),
                'completed_at' => $v->completed_at?->toISOString(),
                'expires_at' => $v->expires_at?->toISOString(),
                'rejection_reason' => $v->rejection_reason,
                'rejection_code' => $v->rejection_code,
                'created_at' => $v->created_at?->toISOString(),
            ])
            ->values()
            ->all();
    }

    /**
     * Record a webhook event (idempotent on provider event id) and queue processing.
     */
    public function recordWebhook(string $provider, array $payload, array $headers, string $rawBody): void
    {
        $normalized = KycWebhookNormalizer::normalize($payload);
        $eventId = $normalized['event_id'];
        $sessionId = $normalized['session_id'];
        $type = $normalized['type'];
        $status = $normalized['status'];

        $event = KycWebhookEvent::where('provider', $provider)
            ->when($eventId !== '', fn ($q) => $q->where('provider_event_id', $eventId))
            ->when($eventId === '', fn ($q) => $q->where('provider_session_id', $sessionId)->where('type', $type))
            ->first();

        if ($event !== null) {
            // Duplicate delivery — ack quickly; retries are handled idempotently downstream.
            if ($event->processing_status === 'processed') {
                Log::info('KYC webhook duplicate ack', ['provider' => $provider, 'event_id' => $eventId]);
            }

            return;
        }

        $event = KycWebhookEvent::create([
            'provider' => $provider,
            'provider_event_id' => $eventId !== '' ? $eventId : null,
            'provider_session_id' => $sessionId !== '' ? $sessionId : null,
            'type' => $type !== '' ? $type : null,
            'status' => $status !== '' ? $status : null,
            'processing_status' => 'pending',
            'raw_payload' => $payload,
            'received_at' => now(),
        ]);

        Log::info('KYC webhook received', [
            'provider' => $provider,
            'event_id' => $eventId,
            'session_id' => $sessionId,
            'type' => $type,
            'webhook_event_id' => $event->id,
        ]);

        ProcessKycWebhook::dispatch($event);
    }

    public function createVerification(User $user, string $provider, ?string $sessionId = null): KycVerification
    {
        return KycVerification::create([
            'user_id' => $user->id,
            'provider' => $provider,
            'status' => KycStatus::Pending->value,
            'provider_session_id' => $sessionId,
            'started_at' => now(),
        ]);
    }

    /**
     * Apply a decision (verified/rejected/expired) to a verification and the user cache.
     */
    public function applyDecision(KycVerification $verification, string $status, ?string $reason = null, ?string $code = null, array $metadata = []): void
    {
        DB::transaction(function () use ($verification, $status, $reason, $code, $metadata) {
            $verification->update([
                'status' => $status,
                'rejection_reason' => $reason,
                'rejection_code' => $code,
                'completed_at' => now(),
                'provider_metadata' => array_merge($verification->provider_metadata ?? [], $metadata),
            ]);

            $user = $verification->user;

            if ($status === KycStatus::Verified->value) {
                $user->update([
                    'kyc_status' => KycStatus::Verified->value,
                    'kyc_rejection_reason' => null,
                    'kyc_verification_id' => $verification->id,
                ]);

                $this->notifications->actionEmail(
                    user: $user,
                    title: 'Your identity verification was approved',
                    bodyHtml: '<p>Great news — your identity (KYC) verification has been <strong>approved</strong>. You now have full access to payments, withdrawals, and all of your account capabilities.</p>',
                    actionLabel: 'View your account',
                    actionUrl: NotificationService::link('app'),
                    template: 'kyc_approved',
                );
            } elseif ($status === KycStatus::Rejected->value) {
                $user->update([
                    'kyc_status' => KycStatus::Rejected->value,
                    'kyc_rejection_reason' => $reason,
                    'kyc_verification_id' => $verification->id,
                ]);

                $this->notifications->actionEmail(
                    user: $user,
                    title: 'Your identity verification needs attention',
                    bodyHtml: '<p>Thank you for submitting your identity (KYC) documents. Unfortunately, your verification could <strong>not be approved</strong> at this time.</p>' . ($reason ? "<p>Reason provided:</p><blockquote style=\"margin:0; padding:12px 16px; border-left:3px solid #EF4444; background:#FEF2F2; border-radius:8px; color:#4B5563;\">" . e($reason) . "</blockquote>" : '') . '<p>You can review your details and submit again — we&rsquo;re happy to help if you have questions.</p>',
                    actionLabel: 'Resubmit verification',
                    actionUrl: NotificationService::link('app/settings/kyc'),
                    template: 'kyc_rejected',
                    data: ['reason' => (string) $reason],
                );
            } elseif ($status === KycStatus::Expired->value) {
                if ($user->kyc_status === KycStatus::Pending->value) {
                    $user->update([
                        'kyc_status' => KycStatus::Expired->value,
                        'kyc_verification_id' => $verification->id,
                    ]);
                }
            }
        });
    }

    /**
     * Find the verification matching a provider session id, or seed a pending row for it.
     */
    public function resolveSessionVerification(string $provider, string $sessionId, ?int $userId = null): ?KycVerification
    {
        $verification = KycVerification::where('provider', $provider)
            ->where('provider_session_id', $sessionId)
            ->first();

        if ($verification !== null) {
            return $verification;
        }

        if ($userId === null) {
            return null;
        }

        return $this->createVerification(
            user: User::find($userId),
            provider: $provider,
            sessionId: $sessionId,
        );
    }
}
