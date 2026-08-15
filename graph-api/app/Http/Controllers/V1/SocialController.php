<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\MainApiClient;
use App\Support\ResponseNormaliser;

/**
 * Phase 2: Social graph edges.
 *
 * GET /v1/users/{id}/posts
 * GET /v1/users/{id}/followers
 * GET /v1/users/{id}/following
 * GET /v1/users/{id}/friends
 */
class SocialController extends Controller
{
    public function __construct(private readonly MainApiClient $mainApi) {}

    /** GET /v1/users/{id}/posts */
    public function userPosts(Request $request, string $id): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->get("v1/users/{$id}/posts", $request->only(['cursor', 'limit']), $token);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/users/{id}/followers */
    public function followers(Request $request, string $id): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->get("v1/users/{$id}/followers", $request->only(['cursor', 'limit']), $token);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/users/{id}/following */
    public function following(Request $request, string $id): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->get("v1/users/{$id}/following", $request->only(['cursor', 'limit']), $token);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/users/{id}/friends */
    public function friends(Request $request, string $id): JsonResponse
    {
        $token = $this->token($request);
        $data  = $this->mainApi->get("v1/friends", [], $token);

        return response()->json(ResponseNormaliser::collection($data));
    }

    private function token(Request $request): string
    {
        return ltrim(str_replace('Bearer', '', $request->header('Authorization', '')));
    }
}
