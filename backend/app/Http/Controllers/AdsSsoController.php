<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\Ads\AdsSsoCodeService;
use App\Services\Ads\AdsSyncService;
use App\Exceptions\AdsEligibilityException;

class AdsSsoController extends Controller
{
    protected AdsSyncService $adsSyncService;

    public function __construct(AdsSyncService $adsSyncService)
    {
        $this->adsSyncService = $adsSyncService;
    }

    /**
     * Generate an SSO token for the authenticated user to login to Ads Studio.
     * POST /api/v1/ads/sso-token
     */
    public function getSsoToken(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        try {
            $ssoData = $this->adsSyncService->generateSsoToken($user);
        } catch (AdsEligibilityException $e) {
            return response()->json([
                'status'  => 'error',
                'message' => $e->getMessage(),
            ], 403);
        }

        return response()->json([
            'status' => 'success',
            'data'   => $ssoData,
        ]);
    }

    /**
     * Launch external Ads Studio with pre-authenticated credentials.
     * GET /api/v1/ads/sso-launch
     */
    public function launchSso(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return redirect('/login');
        }

        try {
            $ssoData = $this->adsSyncService->generateSsoToken($user);
        } catch (AdsEligibilityException $e) {
            $frontendUrl = rtrim((string) env('ADS_FRONTEND_URL', 'http://localhost:5174'), '/');
            return redirect($frontendUrl.'?sso_error=upgrade_required&message='.rawurlencode($e->getMessage()));
        }

        return redirect($ssoData['sso_launch_url']);
    }

    /**
     * Fetch active sponsored ads for specified placement.
     * GET /api/v1/ads/sponsored?placement=right_rail|inter_post
     */
    public function getSponsoredAds(Request $request): JsonResponse
    {
        $user = $request->user('sanctum');

        // Sponsored ads must NOT be shown to admins
        if ($user && $user->role === 'admin') {
            return response()->json([
                'status' => 'suppressed_for_admin',
                'data'   => [],
            ]);
        }

        $placement = $request->query('placement', 'right_rail');
        $limit = (int) $request->query('limit', 2);
        if ($limit < 1 || $limit > 10) $limit = 2;

        $ads = $this->adsSyncService->getSponsoredAds($placement, $user?->id, $limit);

        return response()->json([
            'status' => 'success',
            'placement' => $placement,
            'data'   => $ads,
        ]);
    }

    /**
     * Record impression for a sponsored ad.
     * POST /api/v1/ads/track/impression
     */
    public function trackImpression(Request $request): JsonResponse
    {
        $adId = $request->input('ad_id') ?? $request->input('campaign_id');
        if ($adId) {
            $user = $request->user('sanctum');
            $this->adsSyncService->recordImpression($adId, $user?->id);
        }

        return response()->json(['status' => 'ok']);
    }

    /**
     * Record click for a sponsored ad.
     * POST /api/v1/ads/track/click
     */
    public function trackClick(Request $request): JsonResponse
    {
        $adId = $request->input('ad_id') ?? $request->input('campaign_id');
        if ($adId) {
            $user = $request->user('sanctum');
            $this->adsSyncService->recordClick($adId, $user?->id);
        }

        return response()->json(['status' => 'ok']);
    }

    /**
     * Mint a short-lived, single-use code that Ads Manager exchanges for the
     * user's identity. The redirect target comes from config only.
     * POST /api/v1/ads/sso/code
     */
    public function issueSsoCode(Request $request, AdsSsoCodeService $codes): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $redirectUri = $codes->configuredRedirectUri();
        if ($redirectUri === null) {
            return response()->json(['message' => 'Ads Studio sign-in is not configured.'], 503);
        }

        if (!AdsSyncService::isEligibleForAds($user->role)) {
            return response()->json([
                'message' => 'You must upgrade your MurihSpace account to Creator or Vendor before you can use Ads Studio.',
                'code' => 'ads_upgrade_required',
            ], 403);
        }

        return response()->json([
            'code' => $codes->issue($user, $redirectUri),
            'redirect_uri' => $redirectUri,
            'expires_in' => AdsSsoCodeService::TTL_SECONDS,
        ]);
    }

    /**
     * Server-to-server exchange of an Ads Manager sign-in code.
     * POST /internal/ads/sso/exchange (X-Internal-Token, X-Timestamp, X-Nonce)
     *
     * Returns identity only. Email and phone are never included. The sync into
     * the ads database is keyed on the MurihSpace user id and is best-effort:
     * the identity is returned even when the ads database is unreachable.
     */
    public function exchangeSsoCode(Request $request, AdsSsoCodeService $codes): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'min:32', 'max:128'],
            'redirect_uri' => ['required', 'string', 'max:2048'],
        ]);

        $result = $codes->consume($validated['code'], $validated['redirect_uri']);

        if ($result['status'] === 'invalid') {
            return response()->json(['status' => 'error', 'code' => 'invalid_code', 'message' => 'The sign-in code is invalid, expired or already used.'], 401);
        }

        if ($result['status'] === 'redirect_mismatch') {
            return response()->json(['status' => 'error', 'code' => 'redirect_mismatch', 'message' => 'The redirect URI does not match the one this code was issued for.'], 422);
        }

        if ($result['status'] === 'ineligible') {
            return response()->json(['status' => 'error', 'code' => 'ads_upgrade_required', 'message' => 'This MurihSpace account is not eligible for Ads Studio.'], 403);
        }

        $user = $result['user'];
        $synced = $this->adsSyncService->syncUserToAdsDb($user);

        return response()->json([
            'status' => 'success',
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'username' => $user->username,
                    'avatar_url' => $user->avatar_url,
                ],
                'sync' => [
                    'status' => $synced ? 'synced' : 'unavailable',
                    'key' => 'murihspace_user_id',
                ],
            ],
        ]);
    }
}
