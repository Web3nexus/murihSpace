<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\MainApiClient;
use App\Services\AdsApiClient;
use App\Services\MarketingApiClient;
use App\Support\ResponseNormaliser;

/**
 * Resolves the currently authenticated identity (/v1/me and sub-edges).
 */
class MeController extends Controller
{
    public function __construct(
        private readonly MainApiClient      $mainApi,
        private readonly AdsApiClient       $adsApi,
        private readonly MarketingApiClient $marketingApi,
    ) {}

    /** GET /v1/me */
    public function show(Request $request): JsonResponse
    {
        $token = $this->token($request);
        $user  = $request->attributes->get('graph_user');

        if (!$user) {
            $user = $this->mainApi->getAuthenticatedUser($token);
        }

        return response()->json([
            'data' => ResponseNormaliser::user($user),
            'meta' => [],
        ]);
    }

    /** GET /v1/me/posts */
    public function posts(Request $request): JsonResponse
    {
        $token  = $this->token($request);
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->mainApi->getUserPosts($userId, $request->only(['cursor', 'limit']), $token);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/me/followers */
    public function followers(Request $request): JsonResponse
    {
        $token  = $this->token($request);
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->mainApi->getUserFollowers($userId, $request->only(['cursor', 'limit']), $token);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/me/following */
    public function following(Request $request): JsonResponse
    {
        $token  = $this->token($request);
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->mainApi->getUserFollowing($userId, $request->only(['cursor', 'limit']), $token);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/me/businesses */
    public function businesses(Request $request): JsonResponse
    {
        $token  = $this->token($request);
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->mainApi->getStorefrontProducts($userId, [], $token);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/me/products */
    public function products(Request $request): JsonResponse
    {
        $token  = $this->token($request);
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->mainApi->get(
            "v1/users/{$userId}/products",
            $request->only(['cursor', 'limit']),
            $token
        );

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/me/ad-accounts — proxy to Ads backend */
    public function adAccounts(Request $request): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');
        $data   = $this->adsApi->getAdAccounts(
            $userId,
            $request->only(['cursor', 'limit'])
        );

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/me/tickets — proxy to Marketing backend */
    public function tickets(Request $request): JsonResponse
    {
        $user  = $request->attributes->get('graph_user');
        $email = $user['email'] ?? $request->header('X-Customer-Email', '');
        $data  = $this->marketingApi->getTickets($email, $request->only(['status']));

        return response()->json(ResponseNormaliser::collection($data));
    }


    private function token(Request $request): string
    {
        return ltrim(str_replace('Bearer', '', $request->header('Authorization', '')));
    }
}

