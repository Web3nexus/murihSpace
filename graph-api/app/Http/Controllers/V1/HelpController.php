<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\MarketingApiClient;
use App\Support\ResponseNormaliser;

/**
 * Phase 4: Help Center Knowledge Base.
 *
 * GET /v1/help/categories          — list help article categories
 * GET /v1/help/articles            — list articles (supports filtering)
 * GET /v1/help/articles/{slug}     — show article by slug
 * GET /v1/help/search              — search articles
 * POST /v1/help/articles/{slug}/feedback — submit article feedback
 */
class HelpController extends Controller
{
    public function __construct(private readonly MarketingApiClient $marketingApi) {}

    /** GET /v1/help/categories */
    public function categories(Request $request): JsonResponse
    {
        $data = $this->marketingApi->getHelpCategories();

        return response()->json([
            'data' => $data['data'] ?? $data,
            'meta' => [],
        ]);
    }

    /** GET /v1/help/articles */
    public function articles(Request $request): JsonResponse
    {
        $data = $this->marketingApi->getHelpArticles($request->only(['category', 'cursor', 'limit']));

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/help/articles/{slug} */
    public function show(Request $request, string $slug): JsonResponse
    {
        $data = $this->marketingApi->getHelpArticle($slug);

        return response()->json([
            'data' => ResponseNormaliser::helpArticle($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    /** GET /v1/help/search */
    public function search(Request $request): JsonResponse
    {
        $q    = (string) $request->query('q', '');
        $data = $this->marketingApi->searchHelp($q);

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** POST /v1/help/articles/{slug}/feedback */
    public function feedback(Request $request, string $slug): JsonResponse
    {
        $data = $this->marketingApi->submitArticleFeedback($slug, $request->all());

        return response()->json([
            'data'    => $data['data'] ?? $data,
            'message' => $data['message'] ?? 'Feedback submitted.',
        ]);
    }
}
