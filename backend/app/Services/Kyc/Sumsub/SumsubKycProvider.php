<?php

namespace App\Services\Kyc\Sumsub;

use App\Models\User;
use App\Services\Kyc\KycDecisionResult;
use App\Services\Kyc\KycProviderInterface;
use App\Services\Kyc\KycSessionResult;
use App\Services\Kyc\VerifiedKycWebhook;
use App\Services\SumsubService;
use Illuminate\Support\Facades\Log;

class SumsubKycProvider implements KycProviderInterface
{
    public function __construct(private readonly SumsubService $sumsub)
    {
    }

    public function name(): string
    {
        return 'sumsub';
    }

    public function isEnabled(): bool
    {
        return $this->sumsub->isEnabled();
    }

    public function createSession(User $user): KycSessionResult
    {
        // Sumsub uses a WebSDK access token (ID document + liveness selfie).
        $applicantId = $user->sumsub_applicant_id;

        if ($applicantId === null) {
            $applicant = $this->sumsub->createApplicant((string) $user->uuid, [
                'firstName' => $user->name,
                'email' => $user->email,
            ]);

            if ($applicant === null || ! isset($applicant['id'])) {
                Log::warning('Sumsub applicant creation failed', [
                    'user_id' => $user->id,
                    'response' => $applicant,
                ]);

                return new KycSessionResult(success: false, message: 'Failed to create verification session.');
            }

            $applicantId = $applicant['id'];
            $user->update(['sumsub_applicant_id' => $applicantId]);
        }

        $token = $this->sumsub->createAccessToken((string) $user->uuid);

        if ($token === null || ! isset($token['token'])) {
            Log::warning('Sumsub token creation failed', ['user_id' => $user->id]);

            return new KycSessionResult(success: false, message: 'Failed to obtain verification access token.');
        }

        return new KycSessionResult(
            success: true,
            sessionId: $applicantId,
            clientToken: $token['token'],
            message: 'Session created.',
        );
    }

    public function fetchDecision(string $sessionId): KycDecisionResult
    {
        $status = $this->sumsub->applicantStatus($sessionId);

        if ($status === null) {
            return new KycDecisionResult(success: false);
        }

        $answer = strtoupper((string) ($status['reviewResult']['reviewAnswer'] ?? ''));
        $platformStatus = match ($answer) {
            'GREEN', 'FINAL' => 'approved',
            'RED' => 'rejected',
            default => 'pending',
        };

        $reason = (string) ($status['reviewResult']['moderationComment']
            ?? $status['reviewResult']['clientComment']
            ?? '');

        return new KycDecisionResult(
            success: true,
            status: $platformStatus,
            reason: $reason !== '' ? $reason : null,
            metadata: $status,
        );
    }

    /**
     * Verify an inbound Sumsub webhook using the X-Payload-Digest header.
     */
    public function verifyWebhook(string $payload, array $headers): ?VerifiedKycWebhook
    {
        $digest = $headers['x-payload-digest'] ?? null;
        $digestAlg = $headers['x-payload-digest-alg'] ?? null;

        if (! $this->sumsub->verifyWebhook($payload, $digest, $digestAlg)) {
            return null;
        }

        $event = json_decode($payload, true);
        if (! is_array($event)) {
            return null;
        }

        $applicantId = (string) ($event['applicantId'] ?? '');
        $type = (string) ($event['type'] ?? '');
        $reviewAnswer = strtoupper((string) ($event['reviewResult']['reviewAnswer'] ?? ''));

        if ($applicantId === '' || $type === '') {
            return null;
        }

        $status = match ($type) {
            'applicantReviewed' => match ($reviewAnswer) {
                'GREEN', 'FINAL' => 'approved',
                'RED' => 'rejected',
                default => 'pending',
            },
            'applicantPending', 'applicantCreated' => 'pending',
            default => '',
        };

        return new VerifiedKycWebhook(
            eventId: (string) ($event['id'] ?? $applicantId),
            sessionId: $applicantId,
            status: $status,
            webhookType: $type,
            payload: $event,
        );
    }
}
