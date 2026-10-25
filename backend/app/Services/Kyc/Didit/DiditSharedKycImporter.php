<?php

namespace App\Services\Kyc\Didit;

use App\Enums\KycStatus;
use App\Models\KycVerification;
use App\Models\User;
use App\Services\Kyc\KycService;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Imports a KYC session that a sister application (MurihPay) shared through
 * Didit's Reusable KYC, so a user already verified there is verified here
 * without a new paid session.
 *
 * The share token must reach this service from the origin app's backend over
 * a server-to-server channel. It is not bound to a user, so it must never be
 * accepted directly from the client.
 */
class DiditSharedKycImporter
{
    public function __construct(
        private readonly DiditApiClient $client,
        private readonly KycService $kyc,
    ) {}

    public function import(User $user, string $shareToken): ?KycVerification
    {
        if (! $this->client->isEnabled()) {
            return null;
        }

        if ($user->kyc_status === KycStatus::Verified->value) {
            return $this->kyc->latestFor($user);
        }

        // Same opaque vendor_data as DiditKycProvider::createSession, so the
        // imported session maps to this user.
        if ($user->uuid === null) {
            $user->update(['uuid' => (string) Str::uuid()]);
            $user->refresh();
        }

        $response = $this->client->importShared([
            'share_token' => $shareToken,
            'workflow_id' => $this->client->workflowId(),
            'vendor_data' => 'murihspace_user_' . $user->uuid,
            // Keep the origin verdict: an Approved session stays Approved
            // instead of being sent back into manual review.
            'trust_review' => true,
        ]);

        if ($response === null) {
            return null;
        }

        // Didit returns 201 on success. 403 also covers a token already
        // imported into this application, which makes a retry safe.
        if ($response['status'] !== 201) {
            Log::warning('Didit shared KYC import rejected', [
                'user_id' => $user->id,
                'status' => $response['status'],
                'error' => $response['body']['detail'] ?? array_key_first($response['body']),
            ]);

            return null;
        }

        $body = $response['body'];
        $sessionId = (string) ($body['session_id'] ?? '');

        if ($sessionId === '') {
            Log::warning('Didit shared KYC import returned no session id', ['user_id' => $user->id]);

            return null;
        }

        $existing = KycVerification::where('provider', 'didit')
            ->where('provider_session_id', $sessionId)
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        // The legal name on the imported identity must match this account's name
        // before we trust it. Otherwise a different person could attach a
        // verification to an account they control.
        $legal = $this->legalName($this->client->fetchDecision($sessionId));
        $nameMatches = $legal !== null && $this->namesMatch((string) $user->name, $legal);

        $verification = $this->kyc->createVerification($user, 'didit', $sessionId);
        $verification->update([
            'provider_metadata' => [
                'imported' => true,
                'shared_from_session' => $body['shared_from_session'] ?? null,
                'session_kind' => $body['session_kind'] ?? null,
                'name_matched' => $nameMatches,
            ],
        ]);

        // Money movement stays locked until the person signing in passes the owner check.
        $user->forceFill(['kyc_provider' => 'didit', 'requires_ownership_check' => true])->save();

        $status = (string) ($body['status'] ?? '');

        if ($status === 'Approved' && $nameMatches) {
            $this->kyc->applyDecision($verification, KycStatus::Verified->value);
        } elseif ($status === 'Declined') {
            $this->kyc->applyDecision($verification, KycStatus::Rejected->value);
        } else {
            // In Review, or Approved with a name mismatch: route to the admin KYC queue.
            $user->update([
                'kyc_status' => KycStatus::Pending->value,
                'kyc_verification_id' => $verification->id,
            ]);
        }

        return $verification->refresh();
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    private function legalName(?array $decision): ?array
    {
        $identity = $decision['id_verifications'][0] ?? null;

        $first = trim((string) ($identity['first_name'] ?? ''));
        $last = trim((string) ($identity['last_name'] ?? ''));

        return $first !== '' && $last !== '' ? [$first, $last] : null;
    }

    /**
     * Every word of the legal first and last name must appear in the account name.
     *
     * @param  array{0: string, 1: string}  $legal
     */
    private function namesMatch(string $accountName, array $legal): bool
    {
        $accountWords = $this->words($accountName);

        return collect([...$this->words($legal[0]), ...$this->words($legal[1])])
            ->every(fn (string $word) => in_array($word, $accountWords, true));
    }

    /**
     * @return list<string>
     */
    private function words(string $value): array
    {
        return array_values(array_filter(preg_split('/\s+/u', mb_strtolower(trim($value))) ?: []));
    }
}
