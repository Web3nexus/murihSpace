<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\NotificationService;
use App\Services\SumsubService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminKycController extends Controller
{
    public function __construct(
        private readonly SumsubService $sumsub,
        private readonly NotificationService $notifications,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['sometimes', 'string', 'in:pending,verified,rejected'],
            'search' => ['sometimes', 'string', 'max:100'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $status = $request->query('status', 'pending');
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 20);

        $query = User::where('kyc_status', $status)
            ->select([
                'id', 'name', 'email', 'username', 'role', 'kyc_status',
                'kyc_document', 'kyc_rejection_reason', 'kyc_provider',
                'sumsub_applicant_id', 'created_at',
            ]);

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('username', 'ilike', "%{$search}%");
            });
        }

        $users = $query->latest()->paginate($perPage);

        $counts = [
            'pending' => User::where('kyc_status', 'pending')->count(),
            'verified' => User::where('kyc_status', 'verified')->count(),
            'rejected' => User::where('kyc_status', 'rejected')->count(),
        ];

        return response()->json([
            'data' => $users,
            'counts' => $counts,
        ]);
    }

    /**
     * Applicant detail for the admin drawer. Merges local user row with live Sumsub status when enabled.
     */
    public function show(Request $request, User $user): JsonResponse
    {
        $sumsubData = null;

        if ($this->sumsub->isEnabled() && $user->sumsub_applicant_id) {
            try {
                $sumsubData = [
                    'status' => $this->sumsub->applicantStatus($user->sumsub_applicant_id),
                    'applicant' => $this->sumsub->applicant($user->sumsub_applicant_id),
                ];
            } catch (\Throwable $e) {
                report($e);
                $sumsubData = ['error' => 'Unable to load live Sumsub status.'];
            }
        }

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'username' => $user->username,
                'role' => $user->role,
                'kyc_status' => $user->kyc_status,
                'kyc_provider' => $user->kyc_provider ?? 'manual',
                'kyc_document' => $user->kyc_document,
                'kyc_rejection_reason' => $user->kyc_rejection_reason,
                'sumsub_applicant_id' => $user->sumsub_applicant_id,
                'created_at' => $user->created_at,
                'sumsub' => $sumsubData,
            ],
        ]);
    }

    public function approve(User $user): JsonResponse
    {
        $user->update([
            'kyc_status' => 'verified',
            'kyc_rejection_reason' => null,
        ]);

        try {
            $this->notifications->actionEmail(
                user: $user,
                title: 'Your identity verification was approved',
                bodyHtml: '<p>Great news — your identity (KYC) verification has been <strong>approved</strong>. You now have full access to payments, withdrawals, and all of your account capabilities.</p>',
                actionLabel: 'View your account',
                actionUrl: NotificationService::link('app'),
                template: 'kyc_approved',
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'id' => $user->id,
            'kyc_status' => $user->kyc_status,
        ]);
    }

    public function reject(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $user->update([
            'kyc_status' => 'rejected',
            'kyc_rejection_reason' => $request->reason,
        ]);

        $reason = e($request->reason);
        try {
            $this->notifications->actionEmail(
                user: $user,
                title: 'Your identity verification needs attention',
                bodyHtml: "<p>Thank you for submitting your identity (KYC) documents. Unfortunately, your verification could <strong>not be approved</strong> at this time.</p><p>Reason provided:</p><blockquote style=\"margin:0; padding:12px 16px; border-left:3px solid #EF4444; background:#FEF2F2; border-radius:8px; color:#4B5563;\">{$reason}</blockquote><p>You can review your details and submit again — we&rsquo;re happy to help if you have questions.</p>",
                actionLabel: 'Resubmit verification',
                actionUrl: NotificationService::link('app/settings/kyc'),
                template: 'kyc_rejected',
                data: ['reason' => $reason],
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'id' => $user->id,
            'kyc_status' => $user->kyc_status,
            'kyc_rejection_reason' => $user->kyc_rejection_reason,
        ]);
    }
}
