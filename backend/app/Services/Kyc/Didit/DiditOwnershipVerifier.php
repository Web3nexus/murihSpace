<?php

namespace App\Services\Kyc\Didit;

use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Confirms that the person signed in is the owner of an account whose identity
 * was verified earlier. Didit compares a fresh selfie with the face it holds for
 * the user's vendor_data, so no session is shared between apps.
 *
 * A confirmation is bound to the sign-in (access token) that completed it, so
 * every login has to confirm for itself.
 */
class DiditOwnershipVerifier
{
    public function __construct(
        private readonly DiditApiClient $client,
        private readonly DiditKycProvider $provider,
    ) {}

    /**
     * Start a selfie check for this user. Returns the hosted URL to open.
     *
     * @return array{session_id: string, url: string}|null
     */
    public function start(User $user): ?array
    {
        $workflowId = (string) config('kyc.didit.ownership_workflow_id');

        if (! $this->client->isEnabled() || $workflowId === '') {
            return null;
        }

        if ($user->uuid === null) {
            $user->update(['uuid' => (string) Str::uuid()]);
            $user->refresh();
        }

        $session = $this->client->createSession([
            'workflow_id' => $workflowId,
            'vendor_data' => $this->vendorData($user),
            'metadata' => [
                'platform' => 'murihspace',
                'purpose' => 'ownership_check',
                'user_id' => $user->id,
            ],
        ]);

        $sessionId = (string) ($session['session_id'] ?? $session['id'] ?? '');
        $url = (string) ($session['url'] ?? '');

        if ($sessionId === '' || $url === '') {
            return null;
        }

        // forceFill, not update(): these columns are never mass-assigned from
        // request data, so a client can't mark ownership as confirmed.
        $user->forceFill([
            'ownership_session_id' => $sessionId,
            'ownership_confirmed_at' => null,
            'ownership_token_id' => null,
        ])->save();

        return ['session_id' => $sessionId, 'url' => $url];
    }

    /**
     * Resolve the pending ownership check for the current sign-in.
     * Returns one of: confirmed | pending | declined | none
     */
    public function check(User $user, ?int $tokenId): string
    {
        if ($this->isConfirmedFor($user, $tokenId)) {
            return 'confirmed';
        }

        if ($user->ownership_session_id === null) {
            return 'none';
        }

        $decision = $this->provider->fetchDecision($user->ownership_session_id);

        if (! $decision->success) {
            return 'pending';
        }

        // The session must belong to this user, not just to a session id we stored.
        $returnedVendorData = $decision->metadata['vendor_data'] ?? null;
        if ($returnedVendorData !== null && $returnedVendorData !== $this->vendorData($user)) {
            Log::warning('Ownership check vendor_data mismatch', ['user_id' => $user->id]);
            $this->clear($user);

            return 'declined';
        }

        return match ($decision->status) {
            'Approved' => $this->confirm($user, $tokenId),
            'Declined' => $this->declineAndClear($user),
            default => 'pending',
        };
    }

    /**
     * Whether this sign-in has passed the owner check. A token-backed sign-in
     * must match the token that confirmed. A cookie session has no token, so it
     * falls back to a recent confirmation.
     */
    public function isConfirmedFor(User $user, ?int $tokenId): bool
    {
        if ($user->ownership_confirmed_at === null) {
            return false;
        }

        if ($tokenId !== null) {
            return (int) $user->ownership_token_id === $tokenId;
        }

        $windowMinutes = (int) config('kyc.ownership_session_minutes', 720);

        return $user->ownership_confirmed_at->gt(now()->subMinutes($windowMinutes));
    }

    private function confirm(User $user, ?int $tokenId): string
    {
        $user->forceFill([
            'ownership_confirmed_at' => now(),
            'ownership_token_id' => $tokenId,
            'ownership_session_id' => null,
        ])->save();

        return 'confirmed';
    }

    private function declineAndClear(User $user): string
    {
        $this->clear($user);

        return 'declined';
    }

    private function clear(User $user): void
    {
        $user->forceFill(['ownership_session_id' => null])->save();
    }

    private function vendorData(User $user): string
    {
        return 'murihspace_user_' . $user->uuid;
    }
}
