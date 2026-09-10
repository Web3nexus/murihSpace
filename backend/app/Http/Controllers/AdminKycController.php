<?php

namespace App\Http\Controllers;

use App\Enums\KycStatus;
use App\Models\AuditLog;
use App\Models\KycVerification;
use App\Models\User;
use App\Services\Kyc\KycService;
use App\Services\NotificationService;
use App\Services\SumsubService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminKycController extends Controller
{
    public function __construct(
        private readonly KycService $kyc,
        private readonly SumsubService $sumsub,
        private readonly NotificationService $notifications,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['sometimes', 'string', 'in:pending,verified,rejected,expired,unsubmitted,all'],
            'search' => ['sometimes', 'string', 'max:100'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $status = $request->query('status', 'pending');
        $search = trim((string) $request->query('search', ''));
        $perPage = (int) $request->query('per_page', 20);

        $query = User::query()
            ->select([
                'id', 'name', 'email', 'username', 'role', 'kyc_status',
                'kyc_document', 'kyc_rejection_reason', 'kyc_provider',
                'sumsub_applicant_id', 'kyc_verification_id', 'created_at',
            ]);

        if ($status === 'unsubmitted') {
            $query->where(function ($q) {
                $q->whereIn('kyc_status', ['unsubmitted', 'not_started'])
                    ->orWhereNull('kyc_status');
            });
        } elseif ($status !== 'all') {
            $query->where('kyc_status', $status);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('username', 'like', "%{$search}%");
            });
        }

        $users = $query->latest()->paginate($perPage);

        $counts = [
            'pending' => User::where('kyc_status', 'pending')->count(),
            'verified' => User::where('kyc_status', 'verified')->count(),
            'rejected' => User::where('kyc_status', 'rejected')->count(),
            'unsubmitted' => User::whereIn('kyc_status', ['unsubmitted', 'not_started'])->orWhereNull('kyc_status')->count(),
            'all' => User::count(),
        ];

        return response()->json([
            'data' => $users,
            'counts' => $counts,
        ]);
    }

    /**
     * Applicant detail for the admin drawer. Merges local user row with verification history.
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
                'verification_id' => $user->kyc_verification_id,
                'verifications' => $this->kyc->history($user),
                'created_at' => $user->created_at,
                'sumsub' => $sumsubData,
            ],
        ]);
    }

    /**
     * List all verification attempts (newest first) with user + provider info.
     */
    public function verifications(Request $request): JsonResponse
    {
        $request->validate([
            'status' => ['sometimes', 'string', 'in:pending,verified,rejected,expired'],
            'provider' => ['sometimes', 'string', 'max:50'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
        ]);

        $query = KycVerification::with('user:id,name,email,username,role,kyc_status')
            ->orderByDesc('id');

        if ($request->query('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->query('provider')) {
            $query->where('provider', $request->query('provider'));
        }

        return response()->json([
            'data' => $query->paginate((int) $request->query('per_page', 20)),
        ]);
    }

    public function approve(User $user): JsonResponse
    {
        $verification = $user->kyc_verification_id !== null
            ? KycVerification::find($user->kyc_verification_id)
            : $user->kycVerifications()->latest('id')->first();

        $provider = $verification?->provider ?? ($user->kyc_provider ?? 'manual');

        if ($verification !== null) {
            $this->kyc->applyDecision($verification, KycStatus::Verified->value);
        } else {
            $verification = $this->kyc->createVerification($user, $provider);
            $this->kyc->applyDecision($verification, KycStatus::Verified->value);
        }

        // Explicitly guarantee user record is updated to verified
        $user->update([
            'kyc_status' => KycStatus::Verified->value,
            'kyc_rejection_reason' => null,
            'kyc_provider' => $provider,
            'kyc_verification_id' => $verification->id,
        ]);

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'kyc.approved',
            'resource_type' => 'kyc_verification',
            'resource_id' => (string) $verification->id,
            'metadata' => [
                'provider' => $provider,
                'manual_admin_approval' => true,
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => "User {$user->name} has been manually marked as KYC verified.",
            'id' => $user->id,
            'name' => $user->name,
            'kyc_status' => $user->fresh()->kyc_status,
        ]);
    }

    public function reject(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $verification = $user->kyc_verification_id !== null
            ? KycVerification::find($user->kyc_verification_id)
            : $user->kycVerifications()->latest('id')->first();

        $provider = $verification?->provider ?? ($user->kyc_provider ?? 'manual');

        if ($verification !== null) {
            $this->kyc->applyDecision($verification, KycStatus::Rejected->value, reason: $request->reason);
        } else {
            $verification = $this->kyc->createVerification($user, $provider);
            $this->kyc->applyDecision($verification, KycStatus::Rejected->value, reason: $request->reason);
        }

        AuditLog::create([
            'user_id' => $user->id,
            'action' => 'kyc.rejected',
            'resource_type' => 'kyc_verification',
            'resource_id' => (string) $verification->id,
            'metadata' => ['provider' => $provider, 'reason' => $request->reason],
        ]);

        $user = $user->fresh();

        return response()->json([
            'id' => $user->id,
            'kyc_status' => $user->kyc_status,
            'kyc_rejection_reason' => $user->kyc_rejection_reason,
        ]);
    }
}
