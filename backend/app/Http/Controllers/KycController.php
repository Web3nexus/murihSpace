<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\SumsubService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class KycController extends Controller
{
    public function __construct(private readonly SumsubService $sumsub)
    {
    }

    /**
     * Get the current user's KYC status.
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'kyc_status' => $user->kyc_status ?? 'unsubmitted',
            'kyc_provider' => $user->kyc_provider ?? 'manual',
            'sumsub_applicant_id' => $user->sumsub_applicant_id,
            'kyc_rejection_reason' => $user->kyc_rejection_reason,
            'sumsub_enabled' => $this->sumsub->isEnabled(),
        ]);
    }

    /**
     * Start Sumsub verification: create/retrieve applicant and return an SDK access token.
     */
    public function start(Request $request): JsonResponse
    {
        if (! $this->sumsub->isEnabled()) {
            return response()->json([
                'message' => 'Sumsub is not configured. Please contact support.',
                'kyc_status' => $request->user()->kyc_status ?? 'unsubmitted',
            ], 503);
        }

        $user = $request->user();

        if ($user->kyc_status === 'verified') {
            return response()->json([
                'message' => 'You are already verified.',
                'kyc_status' => 'verified',
            ]);
        }

        // Prefer a fresh applicant id when none exists yet.
        $applicantId = $user->sumsub_applicant_id;

        if ($applicantId === null) {
            $applicant = $this->sumsub->createApplicant((string) $user->id, [
                'firstName' => $user->name,
                'email' => $user->email,
            ]);

            if ($applicant === null || ! isset($applicant['id'])) {
                Log::warning('Sumsub applicant creation failed', [
                    'user_id' => $user->id,
                    'response' => $applicant,
                ]);

                return response()->json(['message' => 'Failed to create verification session.'], 502);
            }

            $applicantId = $applicant['id'];
            $user->update([
                'sumsub_applicant_id' => $applicantId,
                'kyc_provider' => 'sumsub',
                'kyc_status' => 'pending',
            ]);
        }

        $token = $this->sumsub->createAccessToken((string) $user->id);

        if ($token === null || ! isset($token['token'])) {
            return response()->json(['message' => 'Failed to obtain verification access token.'], 502);
        }

        return response()->json([
            'access_token' => $token['token'],
            'level_name' => $this->sumsub->levelName(),
            'applicant_id' => $applicantId,
            'kyc_status' => $user->kyc_status,
        ]);
    }

    /**
     * Webhook receiver for Sumsub applicant events.
     */
    public function webhook(Request $request): JsonResponse
    {
        $payload = $request->getContent();
        $digest = $request->header('X-Payload-Digest');
        $digestAlg = $request->header('X-Payload-Digest-Alg');

        if (! $this->sumsub->verifyWebhook($payload, $digest, $digestAlg)) {
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

        $user = User::where('sumsub_applicant_id', $applicantId)->first();

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
