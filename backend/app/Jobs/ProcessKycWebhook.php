<?php

namespace App\Jobs;

use App\Enums\KycStatus;
use App\Models\KycVerification;
use App\Models\KycWebhookEvent;
use App\Models\User;
use App\Services\Kyc\KycService;
use App\Services\Kyc\VerifiedKycWebhook;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessKycWebhook implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [30, 120, 600];

    public function __construct(
        public KycWebhookEvent $event,
    ) {}

    public function handle(KycService $kyc): void
    {
        if ($this->event->processing_status === 'processed') {
            return;
        }

        $payload = $this->event->raw_payload ?? [];
        $webhook = $this->toWebhook($payload);

        if ($webhook === null) {
            $this->event->update([
                'processing_status' => 'ignored',
                'processing_error' => 'Payload missing required fields.',
            ]);

            return;
        }

        $this->event->update(['processing_status' => 'processing']);

        if (! $webhook->isDecision()) {
            $this->event->update(['processing_status' => 'processed']);
            Log::info('KYC webhook non-decision, acknowledged', [
                'webhook_event_id' => $this->event->id,
                'type' => $webhook->webhookType,
            ]);

            return;
        }

        $user = $this->resolveUser($webhook);

        if ($user === null) {
            $this->event->update([
                'processing_status' => 'failed',
                'processing_error' => 'No user matched provider session/vendor_data.',
            ]);
            Log::warning('KYC webhook: no user match', [
                'webhook_event_id' => $this->event->id,
                'session_id' => $webhook->sessionId,
            ]);

            return;
        }

        $verification = $kyc->resolveSessionVerification(
            provider: $this->event->provider,
            sessionId: $webhook->sessionId,
            userId: $user->id,
        );

        if ($verification === null) {
            $this->event->update([
                'processing_status' => 'failed',
                'processing_error' => 'Could not resolve verification for session.',
            ]);

            return;
        }

        $this->event->update([
            'status' => $webhook->status,
            'processed_at' => now(),
            'processing_status' => 'processed',
        ]);

        if ($webhook->isApproved()) {
            $kyc->applyDecision($verification, KycStatus::Verified->value);
        } elseif ($webhook->isRejected()) {
            $kyc->applyDecision(
                $verification,
                KycStatus::Rejected->value,
                reason: $this->extractReason($webhook),
                code: $this->extractCode($webhook),
                metadata: ['webhook_status' => $webhook->status],
            );
        } else {
            $kyc->applyDecision(
                $verification,
                KycStatus::Pending->value,
                metadata: ['webhook_status' => $webhook->status],
            );
        }

        Log::info('KYC webhook processed', [
            'webhook_event_id' => $this->event->id,
            'user_id' => $user->id,
            'session_id' => $webhook->sessionId,
            'status' => $webhook->status,
        ]);
    }

    private function toWebhook(array $payload): ?VerifiedKycWebhook
    {
        $eventId = (string) ($payload['event_id'] ?? $payload['eventId'] ?? $payload['id'] ?? '');
        $sessionId = (string) ($payload['session_id'] ?? $payload['sessionId'] ?? $payload['object_id'] ?? $payload['applicantId'] ?? '');
        $webhookType = (string) ($payload['webhook_type'] ?? $payload['type'] ?? $payload['event_type'] ?? '');

        $rawStatus = strtoupper((string) ($payload['reviewResult']['reviewAnswer']
            ?? $payload['status']
            ?? $payload['verification_status']
            ?? $payload['decision']
            ?? ''));

        $status = match (true) {
            in_array($rawStatus, ['GREEN', 'FINAL'], true), in_array(strtolower($rawStatus), ['verified', 'approved', 'passed'], true) => 'approved',
            in_array($rawStatus, ['RED'], true), in_array(strtolower($rawStatus), ['rejected', 'failed', 'declined'], true) => 'rejected',
            default => $rawStatus,
        };

        if ($sessionId === '' || $webhookType === '') {
            return null;
        }

        return new VerifiedKycWebhook(
            eventId: $eventId,
            sessionId: $sessionId,
            status: $status,
            webhookType: $webhookType,
            payload: $payload,
        );
    }

    private function resolveUser(VerifiedKycWebhook $webhook): ?User
    {
        $vendorData = (string) ($webhook->payload['vendor_data'] ?? '');
        if (str_starts_with($vendorData, 'murihspace_user_')) {
            $uuid = substr($vendorData, strlen('murihspace_user_'));
            $user = User::where('uuid', $uuid)->first();
            if ($user !== null) {
                return $user;
            }
        }

        $bySession = KycVerification::where('provider_session_id', $webhook->sessionId)
            ->first()?->user;

        if ($bySession !== null) {
            return $bySession;
        }

        // Legacy Sumsub applicants carry the applicant id directly on the user row.
        return User::where('sumsub_applicant_id', $webhook->sessionId)->first();
    }

    private function extractReason(VerifiedKycWebhook $webhook): ?string
    {
        $reason = $webhook->payload['rejection_reason']
            ?? $webhook->payload['reason']
            ?? ($webhook->payload['verification'] ?? [])['reason']
            ?? null;

        return $reason !== null && $reason !== '' ? (string) $reason : null;
    }

    private function extractCode(VerifiedKycWebhook $webhook): ?string
    {
        $code = $webhook->payload['rejection_code']
            ?? $webhook->payload['code']
            ?? ($webhook->payload['verification'] ?? [])['rejection_code']
            ?? null;

        return $code !== null && $code !== '' ? (string) $code : null;
    }
}
