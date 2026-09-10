<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\Ads\AdsSyncService;

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

        $ssoData = $this->adsSyncService->generateSsoToken($user);

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

        $ssoData = $this->adsSyncService->generateSsoToken($user);
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
}

