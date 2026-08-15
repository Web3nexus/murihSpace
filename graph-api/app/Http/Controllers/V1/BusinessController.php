<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\MainApiClient;
use App\Support\ResponseNormaliser;

/**
 * Phase 2: Business/store objects.
 *
 * GET /v1/businesses/{id}
 * GET /v1/businesses/{id}/products
 * GET /v1/users/{id}/businesses
 * GET /v1/stores/{shortCode}           — public store profile
 * GET /v1/stores/{shortCode}/posts     — public store posts
 */
class BusinessController extends Controller
{
    public function __construct(private readonly MainApiClient $mainApi) {}

    /** GET /v1/businesses/{id} — proxy to storefront show */
    public function show(Request $request, string $id): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->get("v1/storefronts/{$id}", [], $token);

        return response()->json([
            'data' => ResponseNormaliser::business($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    /** GET /v1/businesses/{id}/products */
    public function products(Request $request, string $id): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->get(
            "v1/storefronts/{$id}/products",
            $request->only(['cursor', 'limit', 'type']),
            $token
        );

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/users/{id}/businesses */
    public function userBusinesses(Request $request, string $userId): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->get("v1/users/{$userId}/storefronts", [], $token);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/stores/{shortCode} — public, no auth required */
    public function storeByShortCode(Request $request, string $shortCode): JsonResponse
    {
        $data = $this->mainApi->get("v1/stores/{$shortCode}");

        return response()->json([
            'data' => ResponseNormaliser::business($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    /** GET /v1/stores/{shortCode}/posts — public */
    public function storePosts(Request $request, string $shortCode): JsonResponse
    {
        $data = $this->mainApi->get(
            "v1/stores/{$shortCode}/posts",
            $request->only(['cursor', 'limit'])
        );

        return response()->json(ResponseNormaliser::collection($data));
    }

    private function token(Request $request): string
    {
        return ltrim(str_replace('Bearer', '', $request->header('Authorization', '')));
    }
}
