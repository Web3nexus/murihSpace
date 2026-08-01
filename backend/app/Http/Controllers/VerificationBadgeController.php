<?php

namespace App\Http\Controllers;

use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class VerificationBadgeController extends Controller
{
    public const BADGE_FEE_KEY = 'verification_badge_fee';

    public function __construct(
        private LedgerService $ledgerService,
    ) {}

    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => [
                'status' => $this->resolveStatus($user),
                'expires_at' => $user->verification_badge_expires_at?->toIso8601String(),
                'purchased_at' => $user->verification_badge_purchased_at?->toIso8601String(),
                'auto_renew' => (bool) $user->verification_badge_auto_renew,
                'kyc_verified' => $user->hasVerifiedKyc(),
                'monthly_fee' => (int) config('murihspace.verification_badge_fee'),
                'wallet_balance' => (int) ($user->wallet?->balance ?? 0),
            ],
        ]);
    }

    public function activate(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasVerifiedKyc()) {
            return response()->json([
                'message' => 'Verify your identity (KYC) before activating the verified badge.',
                'code' => 'KYC_REQUIRED',
            ], 403);
        }

        $fee = (int) config('murihspace.verification_badge_fee');
        $wallet = $this->ledgerService->getOrCreateWallet($user->id);

        if ($wallet->balance < $fee) {
            return response()->json([
                'message' => "Insufficient wallet balance. The verified badge costs {$fee} tokens per month.",
                'code' => 'INSUFFICIENT_BALANCE',
            ], 422);
        }

        $this->ledgerService->debit(
            $user->id,
            $fee,
            'MSH',
            'verification_badge',
            'Verified badge subscription (1 month)',
            ['badge' => true],
        );

        $now = now();
        $user->update([
            'verification_badge_status' => 'active',
            'verification_badge_expires_at' => $now->copy()->addMonth(),
            'verification_badge_purchased_at' => $now,
            'verification_badge_auto_renew' => true,
        ]);

        return response()->json([
            'message' => 'Verified badge activated. You can now display the blue checkmark.',
            'data' => [
                'status' => 'active',
                'expires_at' => $user->verification_badge_expires_at->toIso8601String(),
                'auto_renew' => true,
            ],
        ], 201);
    }

    public function renew(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->verification_badge_status !== 'active') {
            return response()->json([
                'message' => 'Activate the verified badge before renewing it.',
                'code' => 'BADGE_NOT_ACTIVE',
            ], 422);
        }

        $fee = (int) config('murihspace.verification_badge_fee');
        $wallet = $this->ledgerService->getOrCreateWallet($user->id);

        if ($wallet->balance < $fee) {
            return response()->json([
                'message' => "Insufficient wallet balance. Renewal costs {$fee} tokens per month.",
                'code' => 'INSUFFICIENT_BALANCE',
            ], 422);
        }

        $this->ledgerService->debit(
            $user->id,
            $fee,
            'MSH',
            'verification_badge_renewal',
            'Verified badge renewal (1 month)',
            ['badge' => true, 'renewal' => true],
        );

        $base = $user->verification_badge_expires_at && $user->verification_badge_expires_at->isFuture()
            ? $user->verification_badge_expires_at
            : now();
        $user->update([
            'verification_badge_status' => 'active',
            'verification_badge_expires_at' => $base->copy()->addMonth(),
            'verification_badge_auto_renew' => true,
        ]);

        return response()->json([
            'message' => 'Verified badge renewed for another month.',
            'data' => [
                'status' => 'active',
                'expires_at' => $user->verification_badge_expires_at->toIso8601String(),
                'auto_renew' => true,
            ],
        ]);
    }

    public function cancelAutoRenew(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->update(['verification_badge_auto_renew' => false]);

        return response()->json([
            'message' => 'Auto-renewal turned off. Your badge will expire at the end of the current period.',
            'data' => ['auto_renew' => false],
        ]);
    }

    private function resolveStatus($user): string
    {
        if ($user->verification_badge_status !== 'active') {
            return $user->verification_badge_status ?? 'none';
        }
        if ($user->verification_badge_expires_at !== null && $user->verification_badge_expires_at->isPast()) {
            return 'expired';
        }
        return 'active';
    }
}
