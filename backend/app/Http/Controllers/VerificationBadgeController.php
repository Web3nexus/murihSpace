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

    public function apply(Request $request): JsonResponse
    {
        $user = $request->user();

        // 0. Idempotency guard — prevent double-charging
        if (
            in_array($user->verification_badge_status, ['under_review', 'active', 'verified'], true)
            && (! $user->verification_badge_expires_at || $user->verification_badge_expires_at->isFuture())
        ) {
            return response()->json([
                'message' => 'A verification badge application is already active or under review.',
                'code'    => 'ALREADY_APPLIED',
                'status'  => $user->verification_badge_status,
            ], 422);
        }

        // 1. Check KYC requirement
        if (! $user->hasVerifiedKyc()) {
            $user->update(['verification_badge_status' => 'kyc_pending']);
            if (in_array($user->kyc_status, ['not_required', null], true)) {
                $user->update(['kyc_status' => 'not_started']);
            }

            return response()->json([
                'message' => 'Identity verification (KYC) is required before applying for the paid verification badge.',
                'code' => 'KYC_REQUIRED',
                'status' => 'kyc_pending',
            ], 422);
        }

        // 2. Check wallet balance
        $fee = (int) config('murihspace.verification_badge_fee');
        $wallet = $this->ledgerService->getOrCreateWallet($user->id);

        if ($wallet->balance < $fee) {
            $user->update(['verification_badge_status' => 'payment_pending']);

            return response()->json([
                'message' => "Insufficient wallet balance. The verified badge costs {$fee} tokens per month.",
                'code' => 'INSUFFICIENT_BALANCE',
                'status' => 'payment_pending',
                'fee' => $fee,
                'wallet_balance' => (int) $wallet->balance,
            ], 422);
        }

        // 3. Debit fee and update status atomically
        \DB::transaction(function () use ($user, $fee) {
            $this->ledgerService->debit(
                $user->id,
                $fee,
                'MSH',
                'verification_badge',
                'Verified badge application (1 month)',
                ['badge' => true],
            );

            $now = now();
            $user->update([
                'verification_badge_status'      => 'under_review',
                'verification_badge_expires_at'  => $now->copy()->addMonth(),
                'verification_badge_purchased_at' => $now,
                'verification_badge_auto_renew'  => true,
            ]);
        });

        $user->refresh();

        return response()->json([
            'message' => 'Verification badge application submitted and is under admin review.',
            'data' => [
                'status'     => 'under_review',
                'expires_at' => $user->verification_badge_expires_at->toIso8601String(),
                'auto_renew' => true,
            ],
        ], 201);
    }

    public function activate(Request $request): JsonResponse
    {
        return $this->apply($request);
    }

    public function renew(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! in_array($user->verification_badge_status, ['active', 'verified'], true)) {
            return response()->json([
                'message' => 'Activate the verified badge before renewing it.',
                'code'    => 'BADGE_NOT_ACTIVE',
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

    // ──────────────────────────────────────────────────────────────────────
    // Admin management
    // ──────────────────────────────────────────────────────────────────────

    public function adminIndex(Request $request): JsonResponse
    {
        $query = \App\Models\User::whereNotNull('verification_badge_status')
            ->select([
                'id', 'name', 'email', 'username', 'role', 'kyc_status',
                'verification_badge_status', 'verification_badge_expires_at',
                'verification_badge_purchased_at', 'verification_badge_auto_renew',
            ])
            ->latest('verification_badge_purchased_at');

        if ($request->query('status')) {
            $query->where('verification_badge_status', $request->query('status'));
        }

        $perPage = max(1, min((int) $request->query('per_page', 25), 100));
        $users = $query->paginate($perPage);

        return response()->json($users);
    }

    public function adminUpdateStatus(Request $request, int $userId): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:active,verified,under_review,rejected,suspended,revoked,expired'],
        ]);

        $user = \App\Models\User::findOrFail($userId);
        $newStatus = $validated['status'];

        $user->update(['verification_badge_status' => $newStatus]);

        \App\Models\AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'verification_badge.status_updated',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
            'metadata' => ['target_user_id' => $user->id, 'new_status' => $newStatus],
        ]);

        return response()->json([
            'success' => true,
            'message' => "Verification badge status for {$user->name} set to {$newStatus}.",
            'data' => [
                'id' => $user->id,
                'status' => $user->verification_badge_status,
            ],
        ]);
    }

    private function resolveStatus($user): string
    {
        if ($user->verification_badge_status !== 'active' && $user->verification_badge_status !== 'verified') {
            return $user->verification_badge_status ?? 'none';
        }
        if ($user->verification_badge_expires_at !== null && $user->verification_badge_expires_at->isPast()) {
            return 'expired';
        }
        return $user->verification_badge_status;
    }
}
