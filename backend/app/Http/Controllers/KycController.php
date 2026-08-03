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
     * Start a verification session with the active provider.
     */
    public function start(Request $request): JsonResponse
    {
        $user = $request->user();

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

        $result = $this->kyc->startSession($user);
        $session = $result['session'];

        if (! $session->success) {
            return response()->json([
                'message' => $session->message ?? 'Failed to create verification session.',
                'kyc_status' => $user->fresh()->kyc_status ?? 'unsubmitted',
            ], 502);
        }

        return response()->json([
            'session_url' => $session->sessionUrl,
            'session_id' => $session->sessionId,
            'provider' => $this->kyc->providerName(),
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

    /**
     * Legacy Sumsub webhook receiver. Kept for backward compatibility with
     * the original Sumsub integration; verify + apply inline.
     */
    public function sumsubWebhook(Request $request, \App\Services\SumsubService $sumsub): JsonResponse
    {
        $payload = $request->getContent();
        $digest = $request->header('X-Payload-Digest');
        $digestAlg = $request->header('X-Payload-Digest-Alg');

        if (! $sumsub->verifyWebhook($payload, $digest, $digestAlg)) {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $event = json_decode($payload, true);
        $type = $event['type'] ?? null;
        $applicantId = $event['applicantId'] ?? null;

        Log::info('Sumsub webhook received', [
            'type' => $type,
            'applicant_id' => $applicantId,
        ]);

        if ($applicantId === null) {
            return response()->json(['message' => 'Accepted.']);
        }

        $user = \App\Models\User::where('sumsub_applicant_id', $applicantId)->first();

        if (! $user) {
            Log::warning('Sumsub webhook for unknown applicant', ['applicant_id' => $applicantId]);

            return response()->json(['message' => 'Accepted.']);
        }

        $reviewResult = $event['reviewResult'] ?? [];
        $answer = strtoupper((string) ($reviewResult['reviewAnswer'] ?? ''));

        switch ($type) {
            case 'applicantReviewed':
                if ($answer === 'GREEN' || $answer === 'FINAL') {
                    $user->update([
                        'kyc_status' => 'verified',
                        'kyc_rejection_reason' => null,
                    ]);
                } elseif ($answer === 'RED') {
                    $user->update([
                        'kyc_status' => 'rejected',
                        'kyc_rejection_reason' => $reviewResult['moderationComment']
                            ?? $reviewResult['clientComment']
                            ?? 'Verification failed.',
                    ]);
                }
                break;

            case 'applicantPending':
            case 'applicantCreated':
                if ($user->kyc_status !== 'verified') {
                    $user->update(['kyc_status' => 'pending']);
                }
                break;

            default:
                break;
        }

        return response()->json(['message' => 'Accepted.']);
    }
}
