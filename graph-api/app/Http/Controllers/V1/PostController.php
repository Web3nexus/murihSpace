<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\MainApiClient;
use App\Support\ResponseNormaliser;

/**
 * GET /v1/posts/{id}
 * GET /v1/posts/{id}/comments
 * GET /v1/posts/{id}/reactions
 */
class PostController extends Controller
{
    public function __construct(private readonly MainApiClient $mainApi) {}

    /** GET /v1/posts/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->getPost($id, $token);

        return response()->json([
            'data' => ResponseNormaliser::post($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    /** GET /v1/posts/{id}/comments */
    public function comments(Request $request, string $id): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->getPostComments($id, $request->only(['cursor', 'limit']), $token);

        return response()->json(ResponseNormaliser::collection($data));
    }

    private function token(Request $request): string
    {
        return ltrim(str_replace('Bearer', '', $request->header('Authorization', '')));
    }
}
