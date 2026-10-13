<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\DigitalProduct;
use App\Models\Message;
use App\Models\PhysicalProduct;
use App\Models\Post;
use App\Models\User;
use App\Models\UserBlock;
use App\Services\HashtagService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SearchController extends Controller
{
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

        $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

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
                ->orderByRaw("CASE 
                    WHEN LOWER(username) = LOWER(?) THEN 0 
                    WHEN LOWER(username) LIKE LOWER(?) THEN 1 
                    WHEN LOWER(name) LIKE LOWER(?) THEN 2 
                    ELSE 3 END", [$cleanQ, "{$cleanQ}%", "{$q}%"])
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
                ->orderByRaw("CASE 
                    WHEN LOWER(name) = LOWER(?) THEN 0 
                    WHEN LOWER(name) LIKE LOWER(?) THEN 1 
                    ELSE 2 END", [$q, "{$q}%"])
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
        $trending = app(HashtagService::class)->trending($limit);

        $trendingTopics = [];
        foreach ($trending as $row) {
            /** @var \App\Models\Hashtag $hashtag */
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

        // 2. Fetch suggested creators (active users with highest follower count, strictly excluding administrators)
        $creatorsQuery = User::whereNull('deleted_at')
            ->where(function ($q) {
                $q->whereNull('role')->orWhere('role', '!=', 'admin');
            })
            ->whereNull('admin_role')
            ->where(function ($q) {
                $q->whereNull('status')->orWhere('status', 'active');
            })
            ->withCount(['followers', 'posts'])
            ->orderByDesc('followers_count')
            ->orderByDesc('posts_count')
            ->take(12)
            ->get();

        $viewer = $request->user('sanctum');
        $followingIds = $viewer
            ? DB::table('follows')->where('follower_id', $viewer->id)->pluck('following_id')->flip()
            : collect();

        $suggestedCreators = $creatorsQuery->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->name,
            'username' => $u->username,
            'avatar' => $u->avatar,
            'avatar_url' => $u->avatar_url ?? $u->avatar,
            'banner_url' => $u->banner_url,
            'bio' => $u->bio,
            'role' => $u->role,
            'followers_count' => $u->followers_count,
            'posts_count' => $u->posts_count,
            'followers' => $u->followers_count >= 1000 ? round($u->followers_count / 1000, 1) . 'K followers' : "{$u->followers_count} followers",
            'is_verified' => $u->hasActiveVerificationBadge(),
            'is_following' => $followingIds->has($u->id),
        ]);

        $featuredTrending = null;
        if (!empty($trendingTopics)) {
            $topTopic = $trendingTopics[0];
            $featuredTrending = [
                'title' => $topTopic['tag'],
                'subtitle' => 'Trending on MurihSpace · ' . $topTopic['count'],
                'tag' => $topTopic['tag'],
                'category' => 'Hot Topic',
            ];
        }

        return response()->json([
            'trending_topics' => $trendingTopics,
            'suggested_creators' => $suggestedCreators,
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
                    ->orWhereJsonContains('hashtags', '#' . $hashtag->tag);
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
     * Strictly enforces administrator privacy (role != 'admin' AND admin_role IS NULL).
     */
    public function suggestedCreators(Request $request): JsonResponse
    {
        $q = trim((string) $request->input('q', ''));

        $query = User::whereNull('deleted_at')
            ->where(function ($sub) {
                $sub->whereNull('role')->orWhere('role', '!=', 'admin');
            })
            ->whereNull('admin_role')
            ->where(function ($sub) {
                $sub->whereNull('status')->orWhere('status', 'active');
            })
            ->when($q !== '', function ($query) use ($q) {
                $like = \Illuminate\Support\Facades\DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';
                $cleanQ = ltrim($q, '@');
                $query->where(function ($sub) use ($q, $cleanQ, $like) {
                    $sub->where('name', $like, "%{$q}%")
                        ->orWhere('username', $like, "%{$cleanQ}%")
                        ->orWhere('bio', $like, "%{$q}%");
                });
            })
            ->withCount(['followers', 'posts'])
            ->orderByDesc('followers_count')
            ->orderByDesc('posts_count');

        $perPage = min(50, max(5, (int) $request->input('per_page', 20)));
        $paginated = $query->paginate($perPage);

        $viewer = $request->user('sanctum');
        $followingIds = $viewer
            ? DB::table('follows')->where('follower_id', $viewer->id)->pluck('following_id')->flip()
            : collect();

        return response()->json([
            'creators' => collect($paginated->items())->map(fn (User $u) => [
                'id' => $u->id,
                'name' => $u->name,
                'username' => $u->username,
                'avatar' => $u->avatar,
                'avatar_url' => $u->avatar_url ?? $u->avatar,
                'banner_url' => $u->banner_url,
                'bio' => $u->bio,
                'role' => $u->role,
                'followers_count' => $u->followers_count,
                'posts_count' => $u->posts_count,
                'followers' => $u->followers_count >= 1000 ? round($u->followers_count / 1000, 1) . 'K followers' : "{$u->followers_count} followers",
                'is_verified' => $u->hasActiveVerificationBadge(),
                'is_following' => $followingIds->has($u->id),
            ]),
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'total' => $paginated->total(),
        ]);
    }

    /**
     * Discover People: combines "People You May Know" (friends of users you follow,
     * mutual followers, users following you) and "Suggested Creators".
     */
    public function people(Request $request): JsonResponse
    {
        $viewer = $request->user('sanctum');
        $userId = $viewer?->id;

        $followingIds = $userId
            ? DB::table('follows')->where('follower_id', $userId)->pluck('following_id')
            : collect();

        // Never surface a user in either direction of a block — neither those
        // the viewer blocked nor those who blocked the viewer.
        $blockedIds = $userId
            ? UserBlock::where('blocker_id', $userId)->pluck('blocked_id')
                ->merge(UserBlock::where('blocked_id', $userId)->pluck('blocker_id'))
            : collect();

        $excludedIds = collect([$userId])
            ->filter()
            ->merge($followingIds)
            ->merge($blockedIds)
            ->unique();

        $peopleYouMayKnow = collect();

        if ($userId) {
            // 1. Friends of people you follow (2nd-degree network)
            if ($followingIds->isNotEmpty()) {
                $followedByMyFollowings = DB::table('follows')
                    ->join('users', 'follows.follower_id', '=', 'users.id')
                    ->join('users as candidates', 'follows.following_id', '=', 'candidates.id')
                    ->whereIn('follows.follower_id', $followingIds)
                    ->where('follows.following_id', '!=', $userId)
                    ->whereNotIn('follows.following_id', $excludedIds)
                    ->whereNull('users.deleted_at')
                    ->where(fn ($q) => $q->whereNull('users.status')->orWhere('users.status', 'active'))
                    ->where(fn ($q) => $q->whereNull('users.role')->orWhere('users.role', '!=', 'admin'))
                    ->whereNull('users.admin_role')
                    ->whereNotIn('follows.follower_id', $blockedIds)
                    ->whereNull('candidates.deleted_at')
                    ->where(fn ($q) => $q->whereNull('candidates.status')->orWhere('candidates.status', 'active'))
                    ->where(fn ($q) => $q->whereNull('candidates.role')->orWhere('candidates.role', '!=', 'admin'))
                    ->whereNull('candidates.admin_role')
                    ->select(
                        'follows.following_id',
                        DB::raw('count(*) as mutual_count'),
                        DB::raw('min(users.username) as sample_username')
                    )
                    ->groupBy('follows.following_id')
                    ->orderByDesc('mutual_count')
                    ->limit(15)
                    ->get();

                if ($followedByMyFollowings->isNotEmpty()) {
                    $targetIds = $followedByMyFollowings->pluck('following_id');
                    $users = User::whereIn('id', $targetIds)
                        ->whereNull('deleted_at')
                        ->where(fn ($q) => $q->whereNull('status')->orWhere('status', 'active'))
                        ->where(fn ($q) => $q->whereNull('role')->orWhere('role', '!=', 'admin'))
                        ->whereNull('admin_role')
                        ->withCount(['followers', 'posts'])
                        ->get()
                        ->keyBy('id');

                    foreach ($followedByMyFollowings as $row) {
                        if ($u = $users->get($row->following_id)) {
                            $sampleUser = $row->sample_username ? "@{$row->sample_username}" : "someone you follow";
                            $reason = $row->mutual_count > 1
                                ? "Followed by {$sampleUser} and " . ($row->mutual_count - 1) . " other friends"
                                : "Followed by {$sampleUser}";

                            $peopleYouMayKnow->push([
                                'id' => $u->id,
                                'name' => $u->name,
                                'username' => $u->username,
                                'avatar' => $u->avatar,
                                'avatar_url' => $u->avatar_url ?? $u->avatar,
                                'bio' => $u->bio,
                                'role' => $u->role,
                                'followers_count' => $u->followers_count,
                                'posts_count' => $u->posts_count,
                                'followers' => $u->followers_count >= 1000 ? round($u->followers_count / 1000, 1) . 'K followers' : "{$u->followers_count} followers",
                                'is_verified' => $u->hasActiveVerificationBadge(),
                                'is_following' => false,
                                'reason' => $reason,
                                'type' => 'friend_of_followed',
                            ]);
                        }
                    }
                }
            }

            // 2. Users who follow you that you don't follow back
            $myFollowersNotFollowed = DB::table('follows')
                ->join('users', 'follows.follower_id', '=', 'users.id')
                ->where('follows.following_id', $userId)
                ->where('follows.follower_id', '!=', $userId)
                ->whereNotIn('follows.follower_id', $excludedIds->merge($peopleYouMayKnow->pluck('id')))
                ->whereNull('users.deleted_at')
                ->where(fn ($q) => $q->whereNull('users.status')->orWhere('users.status', 'active'))
                ->where(fn ($q) => $q->whereNull('users.role')->orWhere('users.role', '!=', 'admin'))
                ->whereNull('users.admin_role')
                ->limit(10)
                ->pluck('follows.follower_id');

            if ($myFollowersNotFollowed->isNotEmpty()) {
                $followerUsers = User::whereIn('id', $myFollowersNotFollowed)
                    ->whereNull('deleted_at')
                    ->where(fn ($q) => $q->whereNull('status')->orWhere('status', 'active'))
                    ->where(fn ($q) => $q->whereNull('role')->orWhere('role', '!=', 'admin'))
                    ->whereNull('admin_role')
                    ->withCount(['followers', 'posts'])
                    ->get();

                foreach ($followerUsers as $u) {
                    $peopleYouMayKnow->push([
                        'id' => $u->id,
                        'name' => $u->name,
                        'username' => $u->username,
                        'avatar' => $u->avatar,
                        'avatar_url' => $u->avatar_url ?? $u->avatar,
                        'bio' => $u->bio,
                        'role' => $u->role,
                        'followers_count' => $u->followers_count,
                        'posts_count' => $u->posts_count,
                        'followers' => $u->followers_count >= 1000 ? round($u->followers_count / 1000, 1) . 'K followers' : "{$u->followers_count} followers",
                        'is_verified' => $u->hasActiveVerificationBadge(),
                        'is_following' => false,
                        'reason' => 'Follows you',
                        'type' => 'follows_you',
                    ]);
                }
            }
        }

        // 3. Fallback / Suggested creators (top active creators)
        $alreadyPicked = $peopleYouMayKnow->pluck('id')->merge($excludedIds);

        $suggestedQuery = User::whereNull('deleted_at')
            ->where(function ($sub) {
                $sub->whereNull('role')->orWhere('role', '!=', 'admin');
            })
            ->whereNull('admin_role')
            ->where(function ($sub) {
                $sub->whereNull('status')->orWhere('status', 'active');
            })
            ->whereNotIn('id', $alreadyPicked)
            ->withCount(['followers', 'posts'])
            ->orderByDesc('followers_count')
            ->orderByDesc('posts_count')
            ->limit(20)
            ->get();

        $followingFlipped = $followingIds->flip();

        $suggestedCreators = $suggestedQuery->map(fn (User $u) => [
            'id' => $u->id,
            'name' => $u->name,
            'username' => $u->username,
            'avatar' => $u->avatar,
            'avatar_url' => $u->avatar_url ?? $u->avatar,
            'bio' => $u->bio,
            'role' => $u->role,
            'followers_count' => $u->followers_count,
            'posts_count' => $u->posts_count,
            'followers' => $u->followers_count >= 1000 ? round($u->followers_count / 1000, 1) . 'K followers' : "{$u->followers_count} followers",
            'is_verified' => $u->hasActiveVerificationBadge(),
            'is_following' => $followingFlipped->has($u->id),
            'reason' => 'Popular creator on MurihSpace',
            'type' => 'suggested_creator',
        ]);

        return response()->json([
            'people_you_may_know' => $peopleYouMayKnow->values(),
            'suggested_creators' => $suggestedCreators->values(),
        ]);
    }
}

