<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\StaffUser;
use App\Services\AuditLogService;
use App\Services\Staff\AdsStaffTokenException;
use App\Services\Staff\AdsStaffTokenIssuer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Super-admin request for a one-time ads staff token for another staff member.
 * The token is returned once and is never stored. Each issue is audited.
 */
class StaffAdsTokenController extends Controller
{
    public function __construct(
        protected AdsStaffTokenIssuer $issuer,
        protected AuditLogService $audit,
    ) {}

    public function issue(Request $request, StaffUser $staff): JsonResponse
    {
        try {
            $issued = $this->issuer->issue($staff);
        } catch (AdsStaffTokenException $e) {
            return $this->refuse($e->getMessage());
        }

        /** @var StaffUser $actor */
        $actor = $request->user('staff_api');

        $this->audit->record(
            AuditLog::STAFF_ADS_TOKEN_ISSUE,
            actor: $actor,
            subject: $staff,
            subject_reference: $staff->email,
            metadata: [
                'ads_role' => $issued['role'],
                'expires_at' => $issued['expires_at']->toIso8601String(),
            ],
        );

        return response()->json([
            'success' => true,
            'data' => [
                'token' => $issued['token'],
                'token_type' => 'ads-staff',
                'role' => $issued['role'],
                'staff_id' => $issued['staff_id'],
                'expires_at' => $issued['expires_at']->toIso8601String(),
            ],
            'message' => 'Ads staff token issued. It is shown once.',
            'errors' => null,
        ], 201);
    }

    private function refuse(string $reason): JsonResponse
    {
        [$status, $message] = match ($reason) {
            'ads_token_unavailable' => [503, 'Ads staff tokens are not configured.'],
            'staff_not_active' => [422, 'Only an active staff member can receive an ads token.'],
            default => [422, 'This staff member has no matching ads role.'],
        };

        return response()->json([
            'success' => false,
            'data' => null,
            'message' => $message,
            'errors' => ['code' => [$reason]],
        ], $status);
    }
}
