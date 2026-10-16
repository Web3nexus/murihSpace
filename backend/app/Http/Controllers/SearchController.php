<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\DigitalProduct;
use App\Models\Hashtag;
use App\Models\Message;
use App\Models\PhysicalProduct;
use App\Models\Post;
use App\Models\User;
use App\Services\HashtagService;
use App\Services\Recommendation\UserRecommendationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SearchController extends Controller
{
    public function __construct(
        private readonly HashtagService $hashtags,
        private readonly UserRecommendationService $recommendations,
    ) {}

    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => ['required', 'string', 'max:100'],
            'type' => ['nullable', 'string', 'in:all,users,communities,posts,messages,products,hashtags'],
        ]);

        $q = trim($request->input('q'));
        $cleanQ = ltrim($q, '@');
        $type = $request->input('type', 'all');
        $perPage = (int) ($request->input('per_page') ?? $request->input('limit') ?? 15);

        $results = [];

        $like = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

        if ($type === 'all' || $type === 'users') {
            $results['users'] = User::nonAdmin()
                ->where(function ($query) use ($q, $cleanQ, $like) {
                    $query->where('name', $like, "%{$q}%")
                        ->orWhere('username', $like, "%{$cleanQ}%")
                        ->orWhere('email', $like, "%{$q}%");
                })
                ->whereNull('deleted_at')
                ->where(function ($query) {
                    $query->whereNull('status')->orWhere('status', 'active');
                })
                ->orderByRaw('CASE 
                    WHEN LOWER(username) = LOWER(?) THEN 0 
                    WHEN LOWER(username) LIKE LOWER(?) THEN 1 
                    WHEN LOWER(name) LIKE LOWER(?) THEN 2 
                    ELSE 3 END', [$cleanQ, "{$cleanQ}%", "{$q}%"])
                ->take($perPage)
                ->get()
                ->map(fn (User $u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'username' => $u->username,
                    'avatar' => $u->avatar,
                    'avatar_url' => $u->avatar_url ?? $u->avatar,
                    'bio' => $u->bio,
                    'role' => $u->role,
                    'type' => 'user',
                ]);
        }

        if ($type === 'all' || $type === 'communities') {
            $results['communities'] = Community::where(function ($query) use ($q, $like) {
                $query->where('name', $like, "%{$q}%")
                    ->orWhere('slug', $like, "%{$q}%")
                    ->orWhere('description', $like, "%{$q}%");
            })
                ->orderByRaw('CASE 
                    WHEN LOWER(name) = LOWER(?) THEN 0 
                    WHEN LOWER(name) LIKE LOWER(?) THEN 1 
                    ELSE 2 END', [$q, "{$q}%"])
                ->take($perPage)
                ->get()
                ->map(fn (Community $c) => [
                    'id' => $c->id,
                    'name' => $c->name,
                    'slug' => $c->slug,
                    'description' => $c->description,
                    'logo_url' => $c->logo_url,
                    'type' => 'community',
                    'member_count' => $c->member_count,
                ]);
        }

        if ($type === 'all' || $type === 'posts') {
            $results['posts'] = Post::where('content', 'like', "%{$q}%")
                ->whereNull('deleted_at')
                ->take($perPage)
                ->get()
                ->load('author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug')
                ->map(fn (Post $p) => [
                    'id' => $p->id,
                    'content' => str($p->content)->limit(200),
                    'author' => $p->author?->only(['id', 'name', 'username', 'avatar']),
                    'community' => $p->community?->only(['id', 'name', 'slug']),
                    'created_at' => $p->created_at,
                    'type' => 'post',
                ]);
        }

        if ($type === 'all' || $type === 'messages') {
            $results['messages'] = Message::where('content', 'like', "%{$q}%")
                ->whereNull('deleted_at')
                ->take($perPage)
                ->get()
                ->load('user:id,name,username,avatar')
                ->map(fn (Message $m) => [
                    'id' => $m->id,
                    'content' => str($m->content)->limit(200),
                    'sender' => $m->user?->only(['id', 'name', 'username', 'avatar']),
                    'conversation_id' => $m->conversation_id,
                    'created_at' => $m->created_at,
                    'type' => 'message',
                ]);
        }

        if ($type === 'all' || $type === 'products') {
            $products = collect();

            $digital = DigitalProduct::where(function ($query) use ($q) {
                $query->where('title', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            })->take($perPage)->get()
                ->map(fn (DigitalProduct $p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'description' => str($p->description)->limit(200),
                    'price' => $p->price,
                    'currency' => $p->currency ?? 'USD',
                    'type' => 'digital_product',
                ]);
            $products = $products->concat($digital);

            $physical = PhysicalProduct::where(function ($query) use ($q) {
                $query->where('title', 'like', "%{$q}%")
                    ->orWhere('description', 'like', "%{$q}%");
            })->take($perPage)->get()
                ->map(fn (PhysicalProduct $p) => [
                    'id' => $p->id,
                    'title' => $p->title,
                    'description' => str($p->description)->limit(200),
                    'price' => $p->price,
                    'currency' => $p->currency ?? 'USD',
                    'type' => 'physical_product',
                ]);
            $products = $products->concat($physical);

            $results['products'] = $products;
        }

        if ($type === 'all' || $type === 'hashtags') {
            $results['hashtags'] = app(HashtagService::class)
                ->suggest($q, $perPage)
                ->map(fn ($hashtag) => [
                    'tag' => $hashtag->label,
                    'posts_count' => $hashtag->posts_count,
                    'last_used_at' => optional($hashtag->last_used_at)->toIso8601String(),
                    'type' => 'hashtag',
                ])
                ->values();
        }

        return response()->json([
            'query' => $q,
            'type' => $type,
            'results' => $results,
            'users' => $results['users'] ?? [],
            'communities' => $results['communities'] ?? [],
            'posts' => $results['posts'] ?? [],
            'products' => $results['products'] ?? [],
            'messages' => $results['messages'] ?? [],
            'hashtags' => $results['hashtags'] ?? [],
        ]);
    }

    /**
     * Return real trending hashtags/topics and suggested creators for Discover.
     *
     * Trending is derived entirely from tracked hashtag activity (a time-decayed
     * sum over daily usage buckets). Nothing here is hardcoded or fabricated —
     * a young platform simply returns fewer (or no) topics.
     */
    public function trending(Request $request): JsonResponse
    {
        $limit = min(25, max(1, (int) $request->input('limit', 10)));
        $trending = $this->hashtags->trending($limit);

        $trendingTopics = [];
        foreach ($trending as $row) {
            /** @var Hashtag $hashtag */
            $hashtag = $row['hashtag'];
            $count = $row['window_posts'] > 0 ? $row['window_posts'] : $hashtag->posts_count;

            $trendingTopics[] = [
                'tag' => $hashtag->label,
                'count' => $count === 1 ? '1 post' : "{$count} posts",
                'raw_count' => $count,
                'posts_count' => $hashtag->posts_count,
                'trend_score' => $row['score'],
                'growth' => $row['growth'],
                'is_growing' => $row['growth'] > 0,
                'last_used_at' => optional($hashtag->last_used_at)->toIso8601String(),
            ];
        }

        $viewer = $request->user('sanctum');
        $creatorsResult = $this->recommendations->suggestCreators($viewer, limit: 12);
        $vendorsResult = $this->recommendations->suggestVendors($viewer, limit: 12);

        $featuredTrending = null;
        if (! empty($trendingTopics)) {
            $topTopic = $trendingTopics[0];
            $featuredTrending = [
                'title' => $topTopic['tag'],
                'subtitle' => 'Trending on MurihSpace · '.$topTopic['count'],
                'tag' => $topTopic['tag'],
                'category' => 'Hot Topic',
            ];
        }

        return response()->json([
            'trending_topics' => $trendingTopics,
            'suggested_creators' => $creatorsResult['items'],
            'suggested_vendors' => $vendorsResult['items'],
            'featured_trending' => $featuredTrending,
        ]);
    }

    /**
     * Autocomplete / suggestion list of real hashtags for the post composer.
     */
    public function hashtagSuggestions(Request $request): JsonResponse
    {
        $limit = min(25, max(1, (int) $request->input('limit', 10)));
        $query = (string) $request->input('q', '');

        $hashtags = app(HashtagService::class)->suggest($query, $limit)->map(fn ($hashtag) => [
            'tag' => $hashtag->label,
            'posts_count' => $hashtag->posts_count,
            'trending_score' => null,
            'last_used_at' => optional($hashtag->last_used_at)->toIso8601String(),
        ])->values();

        return response()->json([
            'data' => $hashtags,
            'hashtags' => $hashtags,
        ]);
    }

    /**
     * Explore a single hashtag: metadata plus its most recent public posts.
     */
    public function hashtag(Request $request, string $tag): JsonResponse
    {
        $hashtag = app(HashtagService::class)->find($tag);

        if (! $hashtag) {
            return response()->json(['message' => 'Hashtag not found.'], 404);
        }

        $perPage = min(50, max(1, (int) $request->input('per_page', 20)));

        $posts = Post::with(['author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug'])
            ->published()
            ->where(function ($query) use ($hashtag) {
                $query->whereJsonContains('hashtags', $hashtag->label)
                    ->orWhereJsonContains('hashtags', $hashtag->display_tag)
                    ->orWhereJsonContains('hashtags', '#'.$hashtag->tag);
            })
            ->latest()
            ->paginate($perPage);

        return response()->json([
            'data' => [
                'tag' => $hashtag->label,
                'posts_count' => $hashtag->posts_count,
                'first_used_at' => optional($hashtag->first_used_at)->toIso8601String(),
                'last_used_at' => optional($hashtag->last_used_at)->toIso8601String(),
                'posts' => $posts->items(),
            ],
            'meta' => [
                'current_page' => $posts->currentPage(),
                'last_page' => $posts->lastPage(),
                'total' => $posts->total(),
            ],
        ]);
    }

    /**
     * Paginated suggested creators endpoint for the "View All" screen.
     * Strictly requires role = 'creator' (or is_creator_account = true), excluding admins, suspended, etc.
     */
    public function suggestedCreators(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q', ''));
        $page = max(1, (int) $request->input('page', 1));
        $perPage = min(50, max(5, (int) $request->input('per_page', 20)));
        $viewer = $request->user('sanctum');

        $result = $this->recommendations->suggestCreators(
            viewer: $viewer,
            limit: $perPage,
            page: $page,
            search: $q !== '' ? $q : null,
        );

        return response()->json([
            'creators' => $result['items'],
            'current_page' => $result['current_page'],
            'last_page' => $result['last_page'],
            'total' => $result['total'],
            'per_page' => $result['per_page'],
        ]);
    }

    /**
     * Paginated suggested vendors endpoint for the "View All" screen.
     * Strictly requires role = 'vendor', excluding admins, creators, members, suspended, etc.
     */
    public function suggestedVendors(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q', ''));
        $page = max(1, (int) $request->input('page', 1));
        $perPage = min(50, max(5, (int) $request->input('per_page', 20)));
        $viewer = $request->user('sanctum');

        $result = $this->recommendations->suggestVendors(
            viewer: $viewer,
            limit: $perPage,
            page: $page,
            search: $q !== '' ? $q : null,
        );

        return response()->json([
            'vendors' => $result['items'],
            'current_page' => $result['current_page'],
            'last_page' => $result['last_page'],
            'total' => $result['total'],
            'per_page' => $result['per_page'],
        ]);
    }

    /**
     * Discover People: combines "People You May Know" (2nd-degree mutual network & engaged members),
     * "Suggested Creators" (strictly creators), and "Suggested Vendors" (strictly vendors).
     */
    public function people(Request $request): JsonResponse
    {
        $viewer = $request->user('sanctum');

        $peopleYouMayKnow = $this->recommendations->suggestPeople($viewer, limit: 15);
        $creatorsResult = $this->recommendations->suggestCreators($viewer, limit: 15);
        $vendorsResult = $this->recommendations->suggestVendors($viewer, limit: 15);

        return response()->json([
            'people_you_may_know' => $peopleYouMayKnow->values(),
            'suggested_creators' => $creatorsResult['items'],
            'suggested_vendors' => $vendorsResult['items'],
        ]);
    }
}
