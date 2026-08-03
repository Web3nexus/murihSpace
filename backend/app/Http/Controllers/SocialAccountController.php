<?php

namespace App\Http\Controllers;

use App\Models\SocialAccount;
use App\Services\SocialAccountService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SocialAccountController extends Controller
{
    public function __construct(
        private readonly SocialAccountService $service,
    ) {}

    /**
     * GET /api/v1/social-accounts
     * List all connected accounts for the authenticated user.
     */
    public function index(Request $request): JsonResponse
    {
        $accounts = $request->user()
            ->socialAccounts()
            ->orderBy('provider')
            ->get();

        return response()->json(['data' => $accounts]);
    }

    /**
     * GET /api/v1/social-accounts/follower-summary
     * Returns combined count + per-provider breakdown.
     */
    public function followerSummary(Request $request): JsonResponse
    {
        $user    = $request->user();
        $summary = $this->service->calculateCombinedFollowers($user);

        $threshold   = (int) \App\Models\AdminSetting::get('creator_qualification.follower_threshold', 10000);
        $minAccounts = (int) \App\Models\AdminSetting::get('creator_qualification.min_connected_accounts', 1);
        // Delegate to the service so the check is consistent with maybeQueueQualification.
        $meetsThreshold = $this->service->checkQualificationThreshold($user);

        return response()->json([
            'data' => [
                ...$summary,
                'threshold'           => $threshold,
                'min_connected_accounts' => $minAccounts,
                'meets_threshold'     => $meetsThreshold,
            ],
        ]);
    }

    /**
     * POST /api/v1/social-accounts/manual
     * Connect a social account manually (self-reported follower count).
     */
    public function manualConnect(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'provider'       => ['required', 'string', 'in:' . implode(',', SocialAccount::supportedProviders())],
            'username'       => ['required', 'string', 'max:100'],
            'profile_url'    => ['nullable', 'url', 'max:500'],
            'follower_count' => ['required', 'integer', 'min:0', 'max:999999999'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $account = $this->service->manualConnect(
            $request->user(),
            $request->input('provider'),
            $validator->validated()
        );

        return response()->json(['data' => $account], 201);
    }

    /**
     * PATCH /api/v1/social-accounts/{id}
     * Update follower count or username (manual sync).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $account = SocialAccount::where('user_id', $request->user()->id)->findOrFail($id);

        $validator = Validator::make($request->all(), [
            'username'       => ['sometimes', 'string', 'max:100'],
            'profile_url'    => ['sometimes', 'nullable', 'url', 'max:500'],
            'follower_count' => ['sometimes', 'integer', 'min:0', 'max:999999999'],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $data = $validator->validated();
        $data['last_synced_at'] = now();

        // Only mark self-reported when the request actually changes follower_count.
        if (array_key_exists('follower_count', $data)) {
            $data['count_is_self_reported'] = true;
        }

        $account->update($data);

        // Recheck threshold after update
        $this->service->maybeQueueQualification($request->user());

        return response()->json(['data' => $account->fresh()]);
    }

    /**
     * DELETE /api/v1/social-accounts/{id}
     * Disconnect a social account.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $account = SocialAccount::where('user_id', $request->user()->id)->findOrFail($id);
        $account->delete();

        return response()->json(['message' => 'Social account disconnected.']);
    }

    /**
     * GET /api/v1/social-accounts/supported-providers
     * Returns the list of supported providers and which are enabled.
     */
    public function supportedProviders(): JsonResponse
    {
        $enabled = $this->service->enabledProviders();

        $providers = array_map(fn ($p) => [
            'provider' => $p,
            'label'    => SocialAccount::providerLabel($p),
            'enabled'  => in_array($p, $enabled, true),
        ], SocialAccount::supportedProviders());

        return response()->json(['data' => $providers]);
    }
}
