<?php

namespace App\Services\Recommendation;

use App\Models\Country;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Facebook-style intelligent recommendation service for:
 *  1. Suggested Creators (strictly users with role = 'creator' or is_creator_account = true)
 *  2. Suggested Vendors (strictly users with role = 'vendor' or published storefront)
 *  3. People You May Know (strictly non-admin members)
 *
 * Scoring signals:
 *  - 2nd-degree mutual graph: Followed by people the viewer follows (friends-of-friends)
 *  - Engagement affinity: Posts the viewer has reacted to or commented on
 *  - Location proximity: Same country and state/region as the viewer
 *  - Category/niche alignment: Shared creator/vendor category or interests
 *  - Quality & trust: Verified badge, profile completeness, recent activity
 *  - Anti-monopoly diversity jitter: Dynamic hash seed prevents identical static recommendations for all users
 */
class UserRecommendationService
{
    /**
     * Recommend creators with personalized scoring.
     * Strictly requires role = 'creator' (or is_creator_account = true).
     *
     * @return array{items: array<int, array<string, mixed>>, total: int, current_page: int, last_page: int, per_page: int}
     */
    public function suggestCreators(?User $viewer, int $limit = 12, int $page = 1, ?string $search = null): array
    {
        return $this->recommend(
            viewer: $viewer,
            targetRole: 'creator',
            limit: $limit,
            page: $page,
            search: $search,
        );
    }

    /**
     * Recommend vendors with personalized scoring.
     * Strictly requires role = 'vendor'.
     *
     * @return array{items: array<int, array<string, mixed>>, total: int, current_page: int, last_page: int, per_page: int}
     */
    public function suggestVendors(?User $viewer, int $limit = 12, int $page = 1, ?string $search = null): array
    {
        return $this->recommend(
            viewer: $viewer,
            targetRole: 'vendor',
            limit: $limit,
            page: $page,
            search: $search,
        );
    }

    /**
     * Recommend members for "People You May Know".
     * Strictly requires role = 'member' (or non-admin).
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function suggestPeople(?User $viewer, int $limit = 12): Collection
    {
        if (! $viewer) {
            return collect();
        }

        $result = $this->recommend(
            viewer: $viewer,
            targetRole: 'member',
            limit: $limit,
            page: 1,
            search: null,
        );

        return collect($result['items']);
    }

    /**
     * Core recommendation engine.
     *
     * @return array{items: array<int, array<string, mixed>>, total: int, current_page: int, last_page: int, per_page: int}
     */
    private function recommend(?User $viewer, string $targetRole, int $limit = 12, int $page = 1, ?string $search = null): array
    {
        $viewerId = $viewer?->id;

        // 1. Base query with strict role isolation & active checks
        $query = User::whereNull('deleted_at')
            ->where(function ($q) {
                $q->whereNull('status')->orWhere('status', 'active');
            })
            ->where(function ($q) {
                $q->whereNull('role')->orWhere('role', '!=', 'admin');
            })
            ->whereNull('admin_role');

        if ($targetRole === 'creator') {
            $query->where('role', 'creator');
        } elseif ($targetRole === 'vendor') {
            $query->where(function ($q) {
                $q->where('role', 'vendor')
                    ->orWhereHas('storefront');
            })->where('role', '!=', 'creator');
        } else {
            // member / people you may know
            $query->where(function ($q) {
                $q->whereIn('role', ['member', 'user'])
                    ->orWhereNull('role');
            });
        }

        // 2. Exclude viewer, accounts already followed, and blocked accounts
        if ($viewerId) {
            $query->where('id', '!=', $viewerId);

            $followingIds = DB::table('follows')
                ->where('follower_id', $viewerId)
                ->pluck('following_id')
                ->all();

            if (! empty($followingIds)) {
                $query->whereNotIn('id', $followingIds);
            }

            // Exclude blocks (both blocker and blocked)
            $blockedIds = DB::table('user_blocks')
                ->where('blocker_id', $viewerId)
                ->pluck('blocked_id')
                ->merge(
                    DB::table('user_blocks')
                        ->where('blocked_id', $viewerId)
                        ->pluck('blocker_id')
                )
                ->unique()
                ->all();

            if (! empty($blockedIds)) {
                $query->whereNotIn('id', $blockedIds);
            }

            // For member suggestions, also exclude existing friend requests (sent or received)
            if ($targetRole === 'member') {
                $friendReqIds = DB::table('friend_requests')
                    ->where('sender_id', $viewerId)
                    ->pluck('receiver_id')
                    ->merge(
                        DB::table('friend_requests')
                            ->where('receiver_id', $viewerId)
                            ->pluck('sender_id')
                    )
                    ->unique()
                    ->all();

                if (! empty($friendReqIds)) {
                    $query->whereNotIn('id', $friendReqIds);
                }
            }
        }

        // 3. Search query filter (for View All / search inputs)
        if ($search !== null && trim($search) !== '') {
            $term = trim($search);
            $cleanTerm = ltrim($term, '@');
            $like = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

            $query->where(function ($sub) use ($term, $cleanTerm, $like) {
                $sub->where('name', $like, "%{$term}%")
                    ->orWhere('username', $like, "%{$cleanTerm}%")
                    ->orWhere('bio', $like, "%{$term}%");
            });
        }

        // Include relations & counts
        $query->withCount(['followers', 'posts']);
        if ($targetRole === 'vendor') {
            $query->with('storefront');
        }

        // Candidate pool (retrieve up to 100 for scoring and dynamic ranking)
        $candidates = $query->limit(100)->get();
        if ($candidates->isEmpty()) {
            return [
                'items' => [],
                'total' => 0,
                'current_page' => $page,
                'last_page' => 1,
                'per_page' => $limit,
            ];
        }

        // 4. Precompute relational signals for the viewer
        $mutualFollows = collect();
        $engagedAuthorCounts = collect();
        $commentedAuthorCounts = collect();

        if ($viewerId) {
            $followingIds = DB::table('follows')
                ->where('follower_id', $viewerId)
                ->pluck('following_id')
                ->all();

            // 2nd degree network (friends-of-friends)
            if (! empty($followingIds)) {
                $mutualFollows = DB::table('follows')
                    ->join('users', 'follows.follower_id', '=', 'users.id')
                    ->whereIn('follows.follower_id', $followingIds)
                    ->whereNotIn('follows.following_id', array_merge([$viewerId], $followingIds))
                    ->select(
                        'follows.following_id',
                        DB::raw('COUNT(*) as mutual_count'),
                        DB::raw('MIN(users.username) as sample_username'),
                        DB::raw('MIN(users.name) as sample_name')
                    )
                    ->groupBy('follows.following_id')
                    ->get()
                    ->keyBy('following_id');
            }

            // Post reactions engagement in the last 60 days
            $engagedAuthorCounts = DB::table('post_reactions')
                ->join('posts', 'post_reactions.post_id', '=', 'posts.id')
                ->where('post_reactions.user_id', $viewerId)
                ->where('posts.user_id', '!=', $viewerId)
                ->where('post_reactions.created_at', '>=', now()->subDays(60))
                ->select('posts.user_id as author_id', DB::raw('COUNT(*) as count'))
                ->groupBy('posts.user_id')
                ->pluck('count', 'author_id');

            // Post comments engagement in the last 60 days
            $commentedAuthorCounts = DB::table('post_comments')
                ->join('posts', 'post_comments.post_id', '=', 'posts.id')
                ->where('post_comments.user_id', $viewerId)
                ->where('posts.user_id', '!=', $viewerId)
                ->where('post_comments.created_at', '>=', now()->subDays(60))
                ->select('posts.user_id as author_id', DB::raw('COUNT(*) as count'))
                ->groupBy('posts.user_id')
                ->pluck('count', 'author_id');
        }

        $viewerCountry = $viewer?->country;
        $viewerState = $viewer?->state ?? $viewer?->county;
        $countryName = $viewerCountry ? $this->resolveCountryName($viewerCountry) : null;
        $viewerCategory = $viewer?->category;
        $viewerInterests = array_filter(array_map('trim', (array) ($viewer?->interests ?? [])));

        // 5. Score and rank candidates
        $scored = $candidates->map(function (User $u) use (
            $viewerId,
            $targetRole,
            $mutualFollows,
            $engagedAuthorCounts,
            $commentedAuthorCounts,
            $viewerCountry,
            $viewerState,
            $countryName,
            $viewerCategory,
            $viewerInterests
        ) {
            $score = 0.0;
            $reason = null;

            // Signal A: 2nd degree mutual network (weight: up to 35 pts)
            if ($mutual = $mutualFollows->get($u->id)) {
                $count = (int) $mutual->mutual_count;
                $score += min(35.0, $count * 10.0);
                $sample = '@'.$mutual->sample_username;
                $reason = $count > 1
                    ? "Followed by {$sample} and ".($count - 1).' others you follow'
                    : "Followed by {$sample}";
            }

            // Signal B: Engagement affinity (weight: up to 25 pts)
            $likes = (int) ($engagedAuthorCounts->get($u->id) ?? 0);
            $comments = (int) ($commentedAuthorCounts->get($u->id) ?? 0);
            if ($likes > 0 || $comments > 0) {
                $score += min(25.0, ($likes * 5.0) + ($comments * 8.0));
                $reason = $reason ?? ($comments > 0 ? 'Recently interacted with' : 'Based on posts you liked');
            }

            // Signal C: Location proximity (weight: up to 20 pts)
            if ($viewerCountry && $u->country && strcasecmp((string) $viewerCountry, (string) $u->country) === 0) {
                $score += 15.0;
                $locReason = $countryName ? "Popular in {$countryName}" : 'In your area';
                if ($viewerState && $u->state && strcasecmp((string) $viewerState, (string) $u->state) === 0) {
                    $score += 5.0;
                    $locReason = "Near {$u->state}";
                }
                $reason = $reason ?? $locReason;
            }

            // Signal D: Category / Interest alignment (weight: up to 12 pts)
            if ($viewerCategory && $u->category && strcasecmp((string) $viewerCategory, (string) $u->category) === 0) {
                $score += 10.0;
                $reason = $reason ?? "Top in {$u->category}";
            } elseif (! empty($viewerInterests) && ! empty($u->interests)) {
                $uInterests = array_filter(array_map('trim', (array) $u->interests));
                $shared = array_intersect(
                    array_map('strtolower', $viewerInterests),
                    array_map('strtolower', $uInterests)
                );
                if (! empty($shared)) {
                    $score += 8.0;
                    $matchedInterest = ucfirst(reset($shared));
                    $reason = $reason ?? "Matches your interest in {$matchedInterest}";
                }
            }

            // Signal E: Quality & Verification (weight: up to 15 pts)
            if ($u->hasActiveVerificationBadge()) {
                $score += 6.0;
            }
            if ($u->avatar) {
                $score += 2.0;
            }
            if ($u->bio) {
                $score += 2.0;
            }
            // Log-scaled followers score (popular accounts get a sensible bump without dominating)
            $followersCount = (int) $u->followers_count;
            if ($followersCount > 0) {
                $score += min(12.0, log10($followersCount + 1) * 3.5);
            }
            if ((int) $u->posts_count > 0) {
                $score += min(5.0, (int) $u->posts_count * 0.5);
            }

            // Signal F: Anti-monopoly diversity rotation
            // Generates a deterministic hourly rotation seed specific to this (viewer, candidate) pair
            // so different users see organically varied suggestions rather than an identical monolith.
            $hourSeed = date('Y-m-d-H');
            $pairHash = hexdec(substr(md5(($viewerId ?? 'guest').':'.$u->id.':'.$hourSeed), 0, 4));
            $diversityJitter = ($pairHash % 100) / 10.0; // 0.0 to 10.0
            $finalScore = $score + $diversityJitter;

            // Fallback reason based on role
            if (! $reason) {
                $reason = match ($targetRole) {
                    'creator' => $followersCount > 10 ? 'Popular creator on MurihSpace' : 'Suggested creator',
                    'vendor' => 'Recommended vendor on MurihSpace',
                    default => 'Suggested for you',
                };
            }

            return [
                'user' => $u,
                'score' => $finalScore,
                'reason' => $reason,
            ];
        });

        // 6. Sort by computed score descending
        $sorted = $scored->sortByDesc('score')->values();
        $total = $sorted->count();

        // 7. Pagination slice
        $offset = ($page - 1) * $limit;
        $pageItems = $sorted->slice($offset, $limit);

        // 8. Transform to API response shape
        $items = $pageItems->map(function (array $entry) use ($targetRole) {
            /** @var User $u */
            $u = $entry['user'];
            $reason = $entry['reason'];

            $followersCount = (int) $u->followers_count;
            $followersFormatted = $followersCount >= 1000
                ? round($followersCount / 1000, 1).'K followers'
                : "{$followersCount} followers";

            $payload = [
                'id' => $u->id,
                'name' => $u->name,
                'username' => $u->username,
                'avatar' => $u->avatar,
                'avatar_url' => $u->avatar_url ?? $u->avatar,
                'banner_url' => $u->banner_url,
                'bio' => $u->bio,
                'role' => $u->role,
                'followers_count' => $followersCount,
                'posts_count' => (int) $u->posts_count,
                'followers' => $followersFormatted,
                'is_verified' => $u->hasActiveVerificationBadge(),
                'is_following' => false,
                'reason' => $reason,
                'type' => 'suggested_'.$targetRole,
            ];

            if ($targetRole === 'vendor') {
                $store = $u->storefront;
                $payload['store_name'] = $store?->display_name ?? $store?->name ?? $u->name;
                $payload['store_slug'] = $store?->short_code;
                $payload['tagline'] = $store?->tagline;
            }

            return $payload;
        })->values()->all();

        return [
            'items' => $items,
            'total' => $total,
            'current_page' => $page,
            'last_page' => max(1, (int) ceil($total / $limit)),
            'per_page' => $limit,
        ];
    }

    private function resolveCountryName(string $countryCode): ?string
    {
        $code = strtoupper(trim($countryCode));
        if (strlen($code) === 2) {
            $country = Country::find($code);

            return $country?->name;
        }

        return $code;
    }
}
