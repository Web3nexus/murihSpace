<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\MainApiClient;
use App\Support\ResponseNormaliser;

/**
 * Phase 2: Product objects (digital + physical).
 *
 * GET /v1/products/{id}        — single product
 * GET /v1/users/{id}/products  — products listed by a user
 */
class ProductController extends Controller
{
    public function __construct(private readonly MainApiClient $mainApi) {}

    /** GET /v1/products/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        // Try digital product first, fall back to physical (normalise both)
        $token = $this->token($request);
        $data  = $this->mainApi->get("v1/public/products/{$id}", [], $token);

        return response()->json([
            'data' => ResponseNormaliser::product($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    /** GET /v1/users/{id}/products */
    public function userProducts(Request $request, string $userId): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->get(
            "v1/users/{$userId}/products",
            $request->only(['cursor', 'limit', 'type']),
            $token
        );

        return response()->json(ResponseNormaliser::collection($data));
    }

    private function token(Request $request): string
    {
        return ltrim(str_replace('Bearer', '', $request->header('Authorization', '')));
    }
}
