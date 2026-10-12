<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\DigitalProduct;
use App\Models\Message;
use App\Models\PhysicalProduct;
use App\Models\Post;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => ['required', 'string', 'max:100'],
            'type' => ['nullable', 'string', 'in:all,users,communities,posts,messages,products'],
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

        return response()->json([
            'query' => $q,
            'type' => $type,
            'results' => $results,
            'users' => $results['users'] ?? [],
            'communities' => $results['communities'] ?? [],
            'posts' => $results['posts'] ?? [],
            'products' => $results['products'] ?? [],
            'messages' => $results['messages'] ?? [],
        ]);
    }

    /**
     * Return real trending hashtags/topics and suggested creators for Discover.
     */
    public function trending(Request $request): JsonResponse
    {
        // 1. Fetch real posts to extract actual hashtags
        $recentPosts = Post::published()
            ->latest()
            ->take(100)
            ->get(['content', 'hashtags']);

        $tagCounts = [];
        foreach ($recentPosts as $post) {
            if (!empty($post->hashtags) && is_array($post->hashtags)) {
                foreach ($post->hashtags as $tag) {
                    $cleaned = '#' . ltrim(trim($tag), '#');
                    if (strlen($cleaned) > 1) {
                        $tagCounts[$cleaned] = ($tagCounts[$cleaned] ?? 0) + 1;
                    }
                }
            }

            // Also parse hashtags from post content text (#Tag)
            if (!empty($post->content) && preg_match_all('/#(\w+)/u', $post->content, $matches)) {
                foreach ($matches[0] as $match) {
                    $tagCounts[$match] = ($tagCounts[$match] ?? 0) + 1;
                }
            }
        }

        // Default popular platform topics if database has few posts
        $defaults = [
            '#MurihSpace' => 12,
            '#CreatorEconomy' => 9,
            '#Web3' => 8,
            '#Tech' => 7,
            '#Music' => 6,
            '#Travel' => 5,
        ];
        foreach ($defaults as $k => $v) {
            if (!isset($tagCounts[$k])) {
                $tagCounts[$k] = $v;
            }
        }

        arsort($tagCounts);

        $trendingTopics = [];
        $i = 0;
        foreach ($tagCounts as $tag => $count) {
            if ($i++ >= 10) break;
            $trendingTopics[] = [
                'tag' => $tag,
                'count' => $count > 1 ? "{$count} posts" : "1 post",
                'raw_count' => $count,
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
            ]),
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'total' => $paginated->total(),
        ]);
    }
}

