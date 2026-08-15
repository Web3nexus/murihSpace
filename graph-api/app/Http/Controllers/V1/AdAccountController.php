<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\AdsApiClient;
use App\Support\ResponseNormaliser;

/**
 * Phase 3: Ad accounts.
 *
 * GET /v1/ad-accounts                    — authenticated user's ad accounts
 * GET /v1/ad-accounts/{id}               — single ad account
 * GET /v1/ad-accounts/{id}/campaigns     — campaigns in an ad account
 * GET /v1/ad-accounts/{id}/analytics     — account-level analytics report
 * GET /v1/me/ad-accounts                 — alias (handled in MeController)
 */
class AdAccountController extends Controller
{
    public function __construct(private readonly AdsApiClient $adsApi) {}

    /** GET /v1/ad-accounts */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getAdAccounts($userId, $request->only(['cursor', 'limit']));

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/ad-accounts/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getAdAccount($id, $userId);

        return response()->json([
            'data' => ResponseNormaliser::adAccount($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    /** GET /v1/ad-accounts/{id}/campaigns */
    public function campaigns(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getCampaigns($id, $request->only(['cursor', 'limit', 'status']), $userId);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/ad-accounts/{id}/analytics */
    public function analytics(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getAnalytics($id, $request->only(['date_from', 'date_to', 'granularity']), $userId);

        return response()->json([
            'data' => $data['data'] ?? $data,
            'meta' => [],
        ]);
    }
}
