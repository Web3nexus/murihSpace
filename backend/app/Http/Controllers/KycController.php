<?php

namespace App\Http\Controllers;

use App\Services\Kyc\KycService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class KycController extends Controller
{
    public function __construct(private readonly KycService $kyc)
    {
    }

    /**
     * Get the current user's KYC status.
     */
    public function status(Request $request): JsonResponse
    {
        return response()->json($this->kyc->status($request->user()));
    }

    /**
     * List all dynamic conditions/workflows currently triggering a KYC requirement for the user.
     */
    public function triggers(Request $request): JsonResponse
    {
        $user = $request->user();
        $triggers = [];

        // 1. Pending role application
        $roleApp = \App\Models\AccountRoleHistory::where('user_id', $user->id)
            ->where('status', 'pending')
            ->first();
        if ($roleApp) {
            $triggers[] = [
                'type' => 'role_application',
                'title' => "Role Upgrade to {$roleApp->requested_role}",
                'description' => "Identity verification is required before your {$roleApp->requested_role} role can be activated.",
            ];
        }

        // 2. Pending withdrawal request
        $withdrawal = \App\Models\WithdrawalRequest::where('user_id', $user->id)
            ->where('status', 'pending')
            ->first();
        if ($withdrawal) {
            $triggers[] = [
                'type' => 'withdrawal',
                'title' => 'Fund Withdrawal',
                'description' => 'Identity verification is required for creator/vendor withdrawal processing.',
            ];
        }

        // 3. Verification badge
        if ($user->verification_badge_status === 'kyc_pending') {
            $triggers[] = [
                'type' => 'verification_badge',
                'title' => 'Paid Verification Badge',
                'description' => 'Identity verification is required to display the blue checkmark.',
            ];
        }

        return response()->json([
            'kyc_status' => $user->kyc_status ?? 'not_required',
            'required' => ! empty($triggers) || in_array($user->role, ['creator', 'vendor'], true),
            'triggers' => $triggers,
        ]);
    }

    /**
     * Start a verification session with the active provider (or an explicitly requested one).
     */
    public function start(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'provider' => ['sometimes', 'string', 'in:didit,sumsub,manual'],
        ]);

        $providerName = $validated['provider'] ?? null;

        if ($providerName !== null && ! array_key_exists($providerName, $this->kyc->enabledProviders())) {
            return response()->json([
                'message' => 'That verification provider is not enabled.',
                'providers' => $this->kyc->enabledProviders(),
            ], 422);
        }

        if (! $this->kyc->providerEnabled()) {
            return response()->json([
                'message' => 'Automated verification is not configured. Please contact support.',
                'kyc_status' => $user->kyc_status ?? 'unsubmitted',
            ], 503);
        }

        if ($user->kyc_status === 'verified') {
            return response()->json([
                'message' => 'You are already verified.',
                'kyc_status' => 'verified',
            ]);
        }

        $result = $this->kyc->startSession($user, $providerName);
        $session = $result['session'];

        if (! $session->success) {
            return response()->json([
                'message' => $session->message ?? 'Failed to create verification session.',
                'kyc_status' => $user->fresh()->kyc_status ?? 'unsubmitted',
            ], 502);
        }

        return response()->json([
            'session_url' => $session->sessionUrl,
            'access_token' => $session->clientToken,
            'session_id' => $session->sessionId,
            'provider' => $result['verification']?->provider ?? $this->kyc->providerName(),
            'kyc_status' => $user->fresh()->kyc_status,
            'verification_id' => $result['verification']?->id,
        ]);
    }

    /**
     * KYC attempt history for the current user.
     */
    public function history(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->kyc->history($request->user()),
        ]);
    }

    /**
     * Endpoint that the provider redirects the browser to after a session.
     * Returns the current status so the frontend can re-render without polling.
     */
    public function callback(Request $request): JsonResponse
    {
        $request->validate([
            'session_id' => ['sometimes', 'string', 'max:255'],
        ]);

        $user = $request->user();

        Log::info('KYC callback hit', [
            'user_id' => $user->id,
            'session_id' => $request->input('session_id'),
        ]);

        return response()->json($this->kyc->status($user));
    }

    /**
     * Import a verification another app shared with the signed-in user (MurihPay).
     * The token is only valid for this app, for a short window, and only once.
     */
    public function importShared(Request $request, \App\Services\Kyc\Didit\DiditSharedKycImporter $importer): JsonResponse
    {
        $validated = $request->validate(['share_token' => ['required', 'string', 'max:4096']]);

        $user = $request->user();
        $verification = $importer->import($user, $validated['share_token']);

        if ($verification === null) {
            return response()->json([
                'message' => 'This shared verification could not be imported. Request a new one from MurihPay and try again.',
            ], 422);
        }

        return response()->json([
            'kyc_status' => $user->fresh()->kyc_status,
            'kyc_verification_id' => $verification->id,
            // Money movement stays locked until this sign-in passes the owner check.
            'ownership_required' => true,
        ]);
    }

    /**
     * Start a selfie check that confirms the signed-in person owns this account.
     */
    public function ownershipStart(Request $request, \App\Services\Kyc\Didit\DiditOwnershipVerifier $ownership): JsonResponse
    {
        $session = $ownership->start($request->user());

        if ($session === null) {
            return response()->json(['message' => 'Ownership verification is unavailable right now.'], 503);
        }

        return response()->json([
            'session_url' => $session['url'],
            'ownership_status' => 'pending',
        ]);
    }

    /**
     * Resolve the pending ownership check and report whether it is confirmed.
     */
    public function ownershipStatus(Request $request, \App\Services\Kyc\Didit\DiditOwnershipVerifier $ownership): JsonResponse
    {
        $status = $ownership->check($request->user(), $this->currentTokenId($request));

        return response()->json([
            'ownership_status' => $status,
            'confirmed' => $status === 'confirmed',
        ]);
    }

    /**
     * The access token behind this request, or null for a cookie session.
     */
    private function currentTokenId(Request $request): ?int
    {
        $token = $request->user()?->currentAccessToken();

        // A cookie session returns a TransientToken, which has no id.
        return $token instanceof \Laravel\Sanctum\PersonalAccessToken ? $token->getKey() : null;
    }

    /**
     * Public webhook receiver for a given provider.
     * Signature is verified before any state is changed; heavy work is queued.
     */
    public function webhook(Request $request, \App\Services\Kyc\KycProviderManager $providers, string $providerName): JsonResponse
    {
        $payload = $request->getContent();
        $normalized = [];

        foreach ($request->headers->all() as $key => $values) {
            $normalized[$key] = is_array($values) ? ($values[0] ?? '') : $values;
        }

        $provider = $providers->provider($providerName);
        $event = $provider->verifyWebhook($payload, $normalized);

        if ($event === null) {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $decoded = json_decode($payload, true) ?? [];

        $this->kyc->recordWebhook($provider->name(), $decoded, $normalized, $payload);

        return response()->json(['message' => 'Accepted.']);
    }
}
