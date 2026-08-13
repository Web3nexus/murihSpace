<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\HelpArticleListResource;
use App\Http\Resources\HelpArticleResource;
use App\Http\Resources\HelpCategoryResource;
use App\Http\Resources\HelpSearchResource;
use App\Models\HelpArticle;
use App\Models\HelpArticleFeedback;
use App\Models\HelpCategory;
use App\Services\HelpSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class PublicHelpController extends Controller
{
    public function __construct(
        protected HelpSearchService $searchService
    ) {}

    /**
     * GET /api/public/help/search?q=...
     */
    public function search(Request $request): AnonymousResourceCollection
    {
        $q = trim((string) $request->query('q', ''));

        if (mb_strlen($q) < 2) {
            return HelpSearchResource::collection(collect());
        }

        $results = $this->searchService->search($q, max(1, min((int) $request->query('limit', 10), 50)));

        return HelpSearchResource::collection($results);
    }

    /**
     * GET /api/public/help/categories
     */
    public function categories(): AnonymousResourceCollection
    {
        $categories = HelpCategory::query()
            ->where('is_active', true)
            ->whereNull('parent_id')
            ->withCount(['articles' => fn ($q) => $q->published()])
            ->with(['children' => fn ($q) => $q->where('is_active', true)->withCount(['articles' => fn ($cq) => $cq->published()])])
            ->orderBy('sort_order')
            ->get();

        return HelpCategoryResource::collection($categories);
    }

    /**
     * GET /api/public/help/articles?category=getting-started&featured=1&page=1
     */
    public function articles(Request $request): AnonymousResourceCollection
    {
        $categorySlug = $request->query('category');

        $articles = HelpArticle::query()
            ->published()
            ->with('category')
            ->when($categorySlug, fn ($q) => $q->whereHas('category', fn ($cq) => $cq->where('slug', $categorySlug)))
            ->when($request->boolean('featured'), fn ($q) => $q->where('featured', true))
            ->orderByDesc('featured')
            ->orderByDesc('published_at')
            ->paginate(max(1, min((int) $request->query('per_page', 20), 100)));

        return HelpArticleListResource::collection($articles);
    }

    /**
     * GET /api/public/help/articles/{slug}
     */
    public function article(Request $request, string $slug): HelpArticleResource
    {
        $article = HelpArticle::query()
            ->published()
            ->with(['category', 'relatedArticles'])
            ->where('slug', $slug)
            ->first();

        if (! $article) {
            throw new NotFoundHttpException('Article not found.');
        }

        $article->increment('view_count');

        return HelpArticleResource::make($article);
    }

    /**
     * POST /api/public/help/articles/{slug}/feedback
     * Body: { "helpful": true|false, "comment"?: string }
     */
    public function feedback(Request $request, string $slug): JsonResponse
    {
        $article = HelpArticle::query()->published()->where('slug', $slug)->first();

        if (! $article) {
            throw new NotFoundHttpException('Article not found.');
        }

        if (RateLimiter::tooManyAttempts('help-feedback:'.$request->ip(), 5)) {
            abort(429, 'Too many requests.');
        }
        RateLimiter::hit('help-feedback:'.$request->ip(), 3600);

        $validated = Validator::make($request->all(), [
            'helpful' => ['required', 'boolean'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ])->validate();

        $helpful = (bool) $validated['helpful'];

        HelpArticleFeedback::create([
            'article_id' => $article->id,
            'helpful' => $helpful,
            'comment' => $validated['comment'] ?? null,
            'ip_address' => hash('sha256', (string) $request->ip()),
        ]);

        if ($helpful) {
            $article->increment('helpful_count');
        } else {
            $article->increment('not_helpful_count');
        }

        return response()->json(['success' => true, 'message' => 'Feedback recorded.']);
    }
}
