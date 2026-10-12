<?php

namespace App\Http\Controllers\V1;

use GuzzleHttp\Exception\ClientException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use App\Services\MainApiClient;
use App\Support\ResponseNormaliser;

/**
 * Discovery graph edges: trending topics and hashtags.
 *
 * GET /v1/discovery/trending
 * GET /v1/discovery/hashtags
 * GET /v1/discovery/hashtags/{tag}
 */
class DiscoveryController extends Controller
{
    public function __construct(private readonly MainApiClient $mainApi) {}

    /** GET /v1/discovery/trending */
    public function trending(Request $request): JsonResponse
    {
        $token = $this->token($request);
        $raw = $this->mainApi->getTrending($request->only(['limit']), $token);
        $payload = $raw['data'] ?? $raw;

        $topics = array_map(
            [ResponseNormaliser::class, 'hashtag'],
            $payload['trending_topics'] ?? []
        );

        $creators = array_map(
            [ResponseNormaliser::class, 'user'],
            $payload['suggested_creators'] ?? []
        );

        $featured = $payload['featured_trending'] ?? null;

        return response()->json([
            'data' => [
                'trending_topics'    => array_values($topics),
                'suggested_creators' => array_values($creators),
                'featured_trending'  => $featured ? ResponseNormaliser::hashtag($featured) : null,
            ],
            'meta' => [],
        ]);
    }

    /** GET /v1/discovery/hashtags — suggestion list for the composer. */
    public function hashtags(Request $request): JsonResponse
    {
        $token = $this->token($request);
        $raw = $this->mainApi->suggestHashtags($request->only(['q', 'limit']), $token);
        $payload = $raw['data'] ?? $raw;

        if (is_array($payload) && isset($payload['hashtags'])) {
            $items = $payload['hashtags'];
        } elseif (is_array($payload) && isset($payload['data'])) {
            $items = $payload['data'];
        } else {
            $items = is_array($payload) ? $payload : [];
        }

        $normalised = array_map([ResponseNormaliser::class, 'hashtag'], $items);

        return response()->json([
            'data' => array_values($normalised),
            'meta' => [],
        ]);
    }

    /** GET /v1/discovery/hashtags/{tag} */
    public function hashtag(Request $request, string $tag): JsonResponse
    {
        $token = $this->token($request);

        try {
            $raw = $this->mainApi->getHashtag($tag, $token);
        } catch (ClientException $e) {
            if ($e->getResponse() && $e->getResponse()->getStatusCode() === 404) {
                return response()->json([
                    'error' => [
                        'code'    => 'hashtag_not_found',
                        'message' => "Hashtag #{$tag} was not found.",
                    ],
                ], 404);
            }

            throw $e;
        }

        $payload = $raw['data'] ?? $raw;
        $data = $payload['data'] ?? $payload;

        $normalised = ResponseNormaliser::hashtag($data);
        $normalised['posts'] = array_values(array_map(
            [ResponseNormaliser::class, 'post'],
            $data['posts'] ?? []
        ));

        return response()->json([
            'data' => $normalised,
            'meta' => $payload['meta'] ?? [],
        ]);
    }

    private function token(Request $request): string
    {
        return ltrim(str_replace('Bearer', '', $request->header('Authorization', '')));
    }
}
