<?php

namespace App\Services\Kyc\Didit;

use App\Models\User;
use App\Services\Kyc\KycDecisionResult;
use App\Services\Kyc\KycProviderInterface;
use App\Services\Kyc\KycSessionResult;
use App\Services\Kyc\VerifiedKycWebhook;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

class DiditKycProvider implements KycProviderInterface
{
    public function __construct(
        private readonly DiditApiClient $client,
        private readonly DiditWebhookSignatureVerifier $verifier,
    ) {}

    public function name(): string
    {
        return 'didit';
    }

    public function isEnabled(): bool
    {
        return $this->client->isEnabled();
    }

    public function createSession(User $user): KycSessionResult
    {
        // Backfill uuid for pre-existing users (vendor_data must be opaque).
        if ($user->uuid === null) {
            $user->update(['uuid' => (string) Str::uuid()]);
            $user->refresh();
        }

        $session = $this->client->createSession([
            'workflow_id' => (string) config('kyc.didit.workflow_id'),
            // vendor_data MUST be opaque — no PII, only an internal reference.
            'vendor_data' => 'murihspace_user_' . $user->uuid,
            'callback' => $this->callbackUrl(),
            'metadata' => [
                'platform' => 'murihspace',
                'user_id' => $user->id,
            ],
        ]);

        if ($session === null) {
            return new KycSessionResult(success: false, message: 'Didit could not create a verification session.');
        }

        $sessionId = (string) ($session['id'] ?? $session['session_id'] ?? '');
        $sessionUrl = (string) ($session['url'] ?? $session['session_url'] ?? $session['verification_url'] ?? '');

        if ($sessionId === '') {
            Log::warning('Didit create session: no session id returned', [
                'user_id' => $user->id,
                'response' => $session,
            ]);

            return new KycSessionResult(success: false, message: 'Didit did not return a session id.');
        }

        return new KycSessionResult(
            success: true,
            sessionUrl: $sessionUrl !== '' ? $sessionUrl : null,
            sessionId: $sessionId,
            message: 'Session created.',
        );
    }

    public function fetchDecision(string $sessionId): KycDecisionResult
    {
        $decision = $this->client->fetchDecision($sessionId);

        if ($decision === null) {
            return new KycDecisionResult(success: false);
        }

        // Didit decision payload keys (defensive extraction).
        $status = (string) ($decision['status']
            ?? $decision['verification_status']
            ?? $decision['decision']
            ?? ($decision['verification'] ?? [])['status']
            ?? '');
        $reason = (string) ($decision['rejection_reason']
            ?? $decision['reason']
            ?? ($decision['verification'] ?? [])['reason']
            ?? '');
        $code = (string) ($decision['rejection_code']
            ?? $decision['code']
            ?? '');

        return new KycDecisionResult(
            success: $status !== '',
            status: $status !== '' ? $status : null,
            reason: $reason !== '' ? $reason : null,
            code: $code !== '' ? $code : null,
            metadata: $decision,
        );
    }

    public function verifyWebhook(string $payload, array $headers): ?VerifiedKycWebhook
    {
        return $this->verifier->verify($payload, $headers);
    }

    public function callbackUrl(): string
    {
        $url = (string) config('kyc.didit.callback_url');
        if ($url !== '') {
            return $url;
        }

        return rtrim((string) config('app.frontend_url'), '/') . '/app/settings/kyc';
    }
}
