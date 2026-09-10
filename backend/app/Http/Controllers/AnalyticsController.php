<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\User;
use App\Models\FulfilmentOrder;
use App\Models\PhysicalProduct;
use App\Models\DigitalProduct;
use App\Models\BrandDeal;
use App\Models\EmailBroadcast;
use App\Models\ReferralLink;
use App\Models\Referral;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        // Revenue
        $totalRevenue = Order::where('creator_id', $userId)->where('status', 'completed')->sum('total');
        $physicalRevenue = FulfilmentOrder::whereHas('items', fn($q) => $q->whereHas('physicalProduct', fn($q) => $q->where('creator_id', $userId)))
            ->where('status', 'delivered')->sum('total');
        $subscriptionRevenue = Subscription::where('subscriptions.creator_id', $userId)->where('subscriptions.status', 'active')->join('subscription_plans', 'subscriptions.plan_id', '=', 'subscription_plans.id')->sum('subscription_plans.price');

        // Orders
        $totalOrders = Order::where('creator_id', $userId)->count();
        $physicalOrders = FulfilmentOrder::whereHas('items', fn($q) => $q->whereHas('physicalProduct', fn($q) => $q->where('creator_id', $userId)))->count();
        $completedOrders = Order::where('creator_id', $userId)->where('status', 'completed')->count();

        // Products
        $totalProducts = DigitalProduct::where('creator_id', $userId)->count() + PhysicalProduct::where('creator_id', $userId)->count();

        // Followers / Audience
        $totalFollowers = DB::table('community_memberships')
            ->join('communities', 'community_memberships.community_id', '=', 'communities.id')
            ->where('communities.user_id', $userId)
            ->where('community_memberships.role', '!=', 'owner')
            ->count();

        // Referrals
        $linkIds = ReferralLink::where('creator_id', $userId)->pluck('id');
        $totalClicks = ReferralLink::where('creator_id', $userId)->sum('clicks');
        $totalReferrals = Referral::whereIn('referral_link_id', $linkIds)->count();
        $referralRevenue = Referral::whereIn('referral_link_id', $linkIds)->where('reward_paid', true)->sum('reward_amount');

        // Brand Deals
        $activeDeals = BrandDeal::where('creator_id', $userId)->where('status', 'active')->count();
        $dealRevenue = BrandDeal::where('creator_id', $userId)->whereIn('status', ['active', 'completed'])->sum('budget');

        // Email
        $totalBroadcasts = EmailBroadcast::where('creator_id', $userId)->count();
        $totalSent = EmailBroadcast::where('creator_id', $userId)->where('status', 'sent')->sum('sent_count');

        // Subscriptions
        $totalSubscribers = Subscription::where('creator_id', $userId)->where('status', 'active')->count();
        $monthlyRecurring = Subscription::where('subscriptions.creator_id', $userId)->where('subscriptions.status', 'active')->join('subscription_plans', 'subscriptions.plan_id', '=', 'subscription_plans.id')->sum('subscription_plans.price');

        return response()->json([
            'data' => [
                'revenue' => [
                    'total' => $totalRevenue + $physicalRevenue,
                    'physical' => $physicalRevenue,
                    'digital' => $totalRevenue,
                    'subscription' => $subscriptionRevenue,
                    'deals' => $dealRevenue,
                    'referral' => $referralRevenue,
                ],
                'orders' => [
                    'total' => $totalOrders + $physicalOrders,
                    'digital' => $totalOrders,
                    'physical' => $physicalOrders,
                    'completed' => $completedOrders,
                ],
                'products' => [
                    'total' => $totalProducts,
                ],
                'audience' => [
                    'followers' => $totalFollowers,
                    'subscribers' => $totalSubscribers,
                    'monthly_recurring' => $monthlyRecurring,
                ],
                'engagement' => [
                    'broadcasts' => $totalBroadcasts,
                    'emails_sent' => $totalSent,
                    'referral_clicks' => $totalClicks,
                    'referrals' => $totalReferrals,
                    'active_deals' => $activeDeals,
                ],
                'growth' => [
                    'member_since' => $request->user()->created_at->format('Y-m-d'),
                ],
            ],
        ]);
    }

    public function salesTrends(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $days = (int) $request->query('days', 30);

        $since = now()->subDays($days);

        $dailySales = Order::where('creator_id', $userId)
            ->where('created_at', '>=', $since)
            ->select(DB::raw('DATE(created_at) as date'), DB::raw('SUM(total) as revenue'), DB::raw('COUNT(*) as orders'))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json(['data' => $dailySales]);
    }

    public function topProducts(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        return response()->json(['data' => $this->topProductsFor($userId, 5)]);
    }

    private function topProductsFor(int $userId, ?int $limit = null): array
    {
        $digital = DigitalProduct::where('digital_products.creator_id', $userId)
            ->leftJoin('orders', function ($join) {
                $join->on('orders.product_id', '=', 'digital_products.id')
                    ->where('orders.status', '=', 'completed');
            })
            ->selectRaw('digital_products.title as name')
            ->selectRaw("'digital' as type")
            ->selectRaw('COUNT(DISTINCT orders.id) as orders')
            ->selectRaw('COALESCE(SUM(orders.total), 0) as revenue')
            ->groupBy('digital_products.id')
            ->havingRaw('COUNT(DISTINCT orders.id) > 0')
            ->orderByDesc('orders')
            ->get()
            ->map(fn ($p) => [
                'name' => $p->name,
                'type' => $p->type,
                'orders' => (int) $p->orders,
                'revenue' => (float) $p->revenue,
            ]);

        $physical = PhysicalProduct::where('physical_products.creator_id', $userId)
            ->leftJoin('fulfilment_order_items', 'fulfilment_order_items.physical_product_id', '=', 'physical_products.id')
            ->selectRaw('physical_products.title as name')
            ->selectRaw("'physical' as type")
            ->selectRaw('COUNT(DISTINCT fulfilment_order_items.id) as orders')
            ->selectRaw('COALESCE(SUM(fulfilment_order_items.unit_price), 0) as revenue')
            ->groupBy('physical_products.id')
            ->havingRaw('COUNT(DISTINCT fulfilment_order_items.id) > 0')
            ->orderByDesc('orders')
            ->get()
            ->map(fn ($p) => [
                'name' => $p->name,
                'type' => $p->type,
                'orders' => (int) $p->orders,
                'revenue' => (float) $p->revenue,
            ]);

        $combined = $digital->concat($physical)->sortByDesc('orders')->values();

        return $limit ? $combined->take($limit)->all() : $combined->all();
    }

    public function aiSuggestions(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $totalProducts = DigitalProduct::where('creator_id', $userId)->count();
        $totalFollowers = DB::table('community_memberships')
            ->join('communities', 'community_memberships.community_id', '=', 'communities.id')
            ->where('communities.user_id', $userId)
            ->where('community_memberships.role', '!=', 'owner')
            ->count();
        $activeDeals = BrandDeal::where('creator_id', $userId)->where('status', 'active')->count();
        $hasBroadcasts = EmailBroadcast::where('creator_id', $userId)->exists();

        $suggestions = [];

        if ($totalProducts === 0) {
            $suggestions[] = [
                'type' => 'product',
                'title' => 'Create your first digital product',
                'description' => 'Start monetizing your expertise by creating a digital download or online course.',
                'action' => 'Create Product',
                'link' => '/app/store/digital',
            ];
        }

        if ($totalFollowers < 10) {
            $suggestions[] = [
                'type' => 'audience',
                'title' => 'Grow your community',
                'description' => 'Share your community link on social media to attract more followers.',
                'action' => 'View Community',
                'link' => '/app/communities',
            ];
        }

        if ($activeDeals === 0) {
            $suggestions[] = [
                'type' => 'brand',
                'title' => 'Reach out to brands',
                'description' => 'Create your media kit and start pitching to brands for sponsored deals.',
                'action' => 'Create Media Kit',
                'link' => '/app/brand-deals/media-kit',
            ];
        }

        if (!$hasBroadcasts) {
            $suggestions[] = [
                'type' => 'email',
                'title' => 'Send your first broadcast',
                'description' => 'Engage your audience with an email newsletter or promotional update.',
                'action' => 'Create Broadcast',
                'link' => '/app/marketing/broadcasts',
            ];
        }

        // Fallback content ideas (used when real AI is not configured)
        $fallbackIdeas = [
            ['platform' => 'Social', 'idea' => 'Behind-the-scenes: Share how you created your latest product.'],
            ['platform' => 'Email', 'idea' => 'Weekly tip: Share one actionable insight your audience can use today.'],
            ['platform' => 'Community', 'idea' => 'Polls & Questions: Ask your audience what they want to learn next.'],
            ['platform' => 'Store', 'idea' => 'Bundle offer: Combine two popular products at a discount.'],
        ];

        // Build a real dashboard snapshot so the AI can personalise its advice.
        $digest = [
            'products' => $this->productDigest($userId),
            'orders' => [
                'total' => Order::where('creator_id', $userId)->count(),
                'completed' => Order::where('creator_id', $userId)->where('status', 'completed')->count(),
            ],
            'revenue' => [
                'total' => Order::where('creator_id', $userId)->where('status', 'completed')->sum('total'),
            ],
            'audience' => [
                'followers' => $totalFollowers,
                'subscribers' => Subscription::where('creator_id', $userId)->where('status', 'active')->count(),
            ],
            'engagement' => [
                'broadcasts' => EmailBroadcast::where('creator_id', $userId)->count(),
                'emails_sent' => EmailBroadcast::where('creator_id', $userId)->where('status', 'sent')->sum('sent_count'),
                'referral_clicks' => ReferralLink::where('creator_id', $userId)->sum('clicks'),
                'active_deals' => $activeDeals,
            ],
        ];

        try {
            $ai = app(\App\Services\AiService::class)->analyticsInsights($request->user(), $digest);
        } catch (\Throwable $e) {
            report($e);
            $ai = [];
        }

        return response()->json([
            'data' => [
                'insight' => $ai['insight'] ?? null,
                'suggestions' => $suggestions,
                'content_ideas' => $ai['content_ideas'] ?? $fallbackIdeas,
            ],
        ]);
    }

    private function productDigest(int $userId): array
    {
        return $this->topProductsFor($userId, 3);
    }

    public function productPerformance(Request $request): JsonResponse
    {
        $userId = $request->user()->id;
        $perPage = max(1, min((int) $request->query('per_page', 15), 100));

        $digital = DigitalProduct::where('digital_products.creator_id', $userId)
            ->leftJoin('orders', function ($join) {
                $join->on('orders.product_id', '=', 'digital_products.id')
                    ->where('orders.status', '=', 'completed');
            })
            ->selectRaw('digital_products.id, digital_products.title, COUNT(DISTINCT orders.id) as orders, COALESCE(SUM(orders.total), 0) as revenue')
            ->groupBy('digital_products.id')
            ->orderByDesc('orders')
            ->paginate($perPage);

        $data = $digital->through(fn ($p) => [
            'id' => $p->id,
            'title' => $p->title,
            'type' => 'digital',
            'orders' => (int) $p->orders,
            'revenue' => (float) $p->revenue,
        ]);

        return response()->json(['data' => $data]);
    }

    public function chatChannels(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $conversations = \App\Models\Conversation::whereHas('participants', fn($q) => $q->where('user_id', $userId))
            ->withCount('participants')
            ->latest('updated_at')
            ->take(5)
            ->get();

        if ($conversations->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $formatted = $conversations->map(function($c) {
            return [
                'name' => $c->title ?? 'Group Chat',
                'description' => 'Active conversation',
                'type' => $c->type ?? 'general',
                'unread' => 0,
                'new_since_last_visit' => 0,
                'active_members' => $c->participants_count,
                'ai_replies' => 0,
                'ai_reply_percentage' => 0,
                'human_follow_ups' => 0,
                'priority' => 'low',
            ];
        });

        return response()->json(['data' => $formatted]);
    }

    public function contentPlanner(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $items = \App\Models\ContentItem::where('creator_id', $userId)
            ->latest()
            ->take(5)
            ->get();

        if ($items->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $formatted = $items->map(fn ($item) => [
            'id' => $item->id,
            'title' => $item->title,
            'date' => $item->created_at?->toIso8601String(),
            'status' => $item->status,
        ]);

        return response()->json(['data' => $formatted]);
    }

    public function communityActivity(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $members = \App\Models\CommunityMembership::whereHas('community', fn($q) => $q->where('user_id', $userId))
            ->with(['user', 'community'])
            ->latest()
            ->take(5)
            ->get();

        if ($members->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $formatted = $members->map(function($m) {
            $name = $m->user ? $m->user->name : 'Community Member';
            $words = preg_split('/\s+/', trim($name), -1, PREG_SPLIT_NO_EMPTY);
            $initials = strtoupper(mb_substr($words[0] ?? 'M', 0, 1) . mb_substr($words[1] ?? '', 0, 1));
            return [
                'id' => $m->id,
                'user_name' => $name,
                'user_initials' => $initials,
                'action' => 'Joined community ' . ($m->community->name ?? ''),
                'timestamp' => $m->created_at->toIso8601String(),
            ];
        });

        return response()->json(['data' => $formatted]);
    }

    public function creatorPerformance(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        try {
            $userId = $user->id;
            $range = $request->query('range', '28d');
            $days = match ($range) {
                '7d' => 7,
                '90d' => 90,
                default => 28,
            };

            $now = now();
            $startDate = $now->copy()->subDays($days)->startOfDay();
            $priorStartDate = $now->copy()->subDays($days * 2)->startOfDay();

            // 1. Content and Community IDs for this Creator
            $userPostIds = \App\Models\Post::where('user_id', $userId)->pluck('id');
            $userCommunityIds = \App\Models\Community::where('user_id', $userId)->pluck('id');

            // 2. Real Views
            $allPosts = \App\Models\Post::where('user_id', $userId)->get();
            $totalViews = (int) $allPosts->sum('views_count');

            $currPeriodPosts = $allPosts->filter(fn($p) => $p->created_at >= $startDate);
            $priorPeriodPosts = $allPosts->filter(fn($p) => $p->created_at >= $priorStartDate && $p->created_at < $startDate);

            $currPeriodViews = (int) $currPeriodPosts->sum('views_count');
            $priorPeriodViews = (int) $priorPeriodPosts->sum('views_count');

            // 3. Real Engagement (Reactions + Comments + Saves + Shares)
            $currReactions = \App\Models\PostReaction::whereIn('post_id', $userPostIds)->where('created_at', '>=', $startDate)->count();
            $priorReactions = \App\Models\PostReaction::whereIn('post_id', $userPostIds)->whereBetween('created_at', [$priorStartDate, $startDate])->count();

            $currComments = \App\Models\PostComment::whereIn('post_id', $userPostIds)->where('created_at', '>=', $startDate)->count();
            $priorComments = \App\Models\PostComment::whereIn('post_id', $userPostIds)->whereBetween('created_at', [$priorStartDate, $startDate])->count();

            $currSaves = \App\Models\SavedPost::whereIn('post_id', $userPostIds)->where('created_at', '>=', $startDate)->count();
            $priorSaves = \App\Models\SavedPost::whereIn('post_id', $userPostIds)->whereBetween('created_at', [$priorStartDate, $startDate])->count();

            $currShares = (int) $currPeriodPosts->sum('shares_count');
            $priorShares = (int) $priorPeriodPosts->sum('shares_count');

            $totalEngagement = $currReactions + $currComments + $currSaves + $currShares;
            $priorEngagement = $priorReactions + $priorComments + $priorSaves + $priorShares;

            // All-time engagement
            $allTimeEngagement = (int) ($allPosts->sum('likes_count') + $allPosts->sum('comments_count') + $allPosts->sum('shares_count') + $allPosts->sum('saves_count'));

            // 4. Real Net Follows & Total Followers
            $currDirectFollows = DB::table('follows')->where('following_id', $userId)->where('created_at', '>=', $startDate)->count();
            $priorDirectFollows = DB::table('follows')->where('following_id', $userId)->whereBetween('created_at', [$priorStartDate, $startDate])->count();

            $currCommunityJoins = DB::table('community_memberships')
                ->whereIn('community_id', $userCommunityIds)
                ->where('user_id', '!=', $userId)
                ->where('created_at', '>=', $startDate)
                ->count();

            $priorCommunityJoins = DB::table('community_memberships')
                ->whereIn('community_id', $userCommunityIds)
                ->where('user_id', '!=', $userId)
                ->whereBetween('created_at', [$priorStartDate, $startDate])
                ->count();

            $netFollows = $currDirectFollows + $currCommunityJoins;
            $priorNetFollows = $priorDirectFollows + $priorCommunityJoins;

            $directFollowerIds = DB::table('follows')->where('following_id', $userId)->pluck('follower_id');
            $communityMemberIds = DB::table('community_memberships')->whereIn('community_id', $userCommunityIds)->where('user_id', '!=', $userId)->pluck('user_id');
            $totalFollowers = $directFollowerIds->concat($communityMemberIds)->unique()->count();

            // 5. Real Reach (Distinct Accounts Reached & Engaged)
            $currEngagedUsers = collect()
                ->concat(\App\Models\PostReaction::whereIn('post_id', $userPostIds)->where('created_at', '>=', $startDate)->pluck('user_id'))
                ->concat(\App\Models\PostComment::whereIn('post_id', $userPostIds)->where('created_at', '>=', $startDate)->pluck('user_id'))
                ->concat(\App\Models\SavedPost::whereIn('post_id', $userPostIds)->where('created_at', '>=', $startDate)->pluck('user_id'))
                ->concat(DB::table('follows')->where('following_id', $userId)->where('created_at', '>=', $startDate)->pluck('follower_id'))
                ->concat(DB::table('community_memberships')->whereIn('community_id', $userCommunityIds)->where('user_id', '!=', $userId)->where('created_at', '>=', $startDate)->pluck('user_id'))
                ->filter(fn($id) => $id != $userId)
                ->unique();

            $priorEngagedUsers = collect()
                ->concat(\App\Models\PostReaction::whereIn('post_id', $userPostIds)->whereBetween('created_at', [$priorStartDate, $startDate])->pluck('user_id'))
                ->concat(\App\Models\PostComment::whereIn('post_id', $userPostIds)->whereBetween('created_at', [$priorStartDate, $startDate])->pluck('user_id'))
                ->concat(\App\Models\SavedPost::whereIn('post_id', $userPostIds)->whereBetween('created_at', [$priorStartDate, $startDate])->pluck('user_id'))
                ->concat(DB::table('follows')->where('following_id', $userId)->whereBetween('created_at', [$priorStartDate, $startDate])->pluck('follower_id'))
                ->concat(DB::table('community_memberships')->whereIn('community_id', $userCommunityIds)->where('user_id', '!=', $userId)->whereBetween('created_at', [$priorStartDate, $startDate])->pluck('user_id'))
                ->filter(fn($id) => $id != $userId)
                ->unique();

            $reach = max($currPeriodViews, $currEngagedUsers->count());
            $priorReach = max($priorPeriodViews, $priorEngagedUsers->count());

            $calcDelta = function ($curr, $prior) {
                if ($prior == 0) {
                    return $curr > 0 ? 100 : 0;
                }
                return (int) round((($curr - $prior) / $prior) * 100);
            };

            // 6. Real Time Series (PostgreSQL-Safe Memory-Mapped Daily Buckets)
            $postsInRange = \App\Models\Post::where('user_id', $userId)
                ->where('created_at', '>=', $startDate)
                ->get(['created_at', 'views_count']);

            $reactionsInRange = \App\Models\PostReaction::whereIn('post_id', $userPostIds)
                ->where('created_at', '>=', $startDate)
                ->get(['created_at']);

            $commentsInRange = \App\Models\PostComment::whereIn('post_id', $userPostIds)
                ->where('created_at', '>=', $startDate)
                ->get(['created_at']);

            $savesInRange = \App\Models\SavedPost::whereIn('post_id', $userPostIds)
                ->where('created_at', '>=', $startDate)
                ->get(['created_at']);

            $followsInRange = DB::table('follows')
                ->where('following_id', $userId)
                ->where('created_at', '>=', $startDate)
                ->get(['created_at']);

            $joinsInRange = DB::table('community_memberships')
                ->whereIn('community_id', $userCommunityIds)
                ->where('user_id', '!=', $userId)
                ->where('created_at', '>=', $startDate)
                ->get(['created_at']);

            $dailyViews = $postsInRange->groupBy(fn($p) => $p->created_at?->format('Y-m-d') ?? '')->map->sum('views_count');
            $dailyReactions = $reactionsInRange->groupBy(fn($r) => $r->created_at?->format('Y-m-d') ?? '')->map->count();
            $dailyComments = $commentsInRange->groupBy(fn($c) => $c->created_at?->format('Y-m-d') ?? '')->map->count();
            $dailySaves = $savesInRange->groupBy(fn($s) => $s->created_at?->format('Y-m-d') ?? '')->map->count();
            $dailyFollows = $followsInRange->groupBy(fn($f) => $f->created_at ? \Carbon\Carbon::parse($f->created_at)->format('Y-m-d') : '')->map->count();
            $dailyJoins = $joinsInRange->groupBy(fn($j) => $j->created_at ? \Carbon\Carbon::parse($j->created_at)->format('Y-m-d') : '')->map->count();

            $timeSeries = [];
            for ($i = $days - 1; $i >= 0; $i--) {
                $dt = $now->copy()->subDays($i);
                $dayStr = $dt->format('Y-m-d');
                $label = $dt->format('M j');

                $dViews = (int) ($dailyViews[$dayStr] ?? 0);
                $dEng = (int) (($dailyReactions[$dayStr] ?? 0) + ($dailyComments[$dayStr] ?? 0) + ($dailySaves[$dayStr] ?? 0));
                $dFoll = (int) (($dailyFollows[$dayStr] ?? 0) + ($dailyJoins[$dayStr] ?? 0));
                $dReach = max($dViews, $dEng + $dFoll);

                $timeSeries[] = [
                    'date' => $dayStr,
                    'label' => $label,
                    'views' => $dViews,
                    'engagement' => $dEng,
                    'net_follows' => $dFoll,
                    'reach' => $dReach,
                ];
            }

            // 7. Top Content (Sorted by Real Views and Engagement)
            $topContent = \App\Models\Post::where('user_id', $userId)
                ->published()
                ->orderByDesc('views_count')
                ->orderByDesc('likes_count')
                ->take(6)
                ->get()
                ->map(function ($p) {
                    $thumbnail = null;
                    if (!empty($p->media_urls) && is_array($p->media_urls) && count($p->media_urls) > 0) {
                        $thumbnail = $p->media_urls[0];
                    }
                    return [
                        'id' => $p->id,
                        'title' => mb_strimwidth(strip_tags($p->content ?? 'Untitled post'), 0, 70, '...'),
                        'thumbnail' => $thumbnail,
                        'created_at' => $p->created_at?->toIso8601String(),
                        'views' => (int) $p->views_count,
                        'engagement' => (int) ($p->likes_count + $p->comments_count + $p->shares_count + $p->saves_count),
                        'likes' => (int) $p->likes_count,
                        'comments' => (int) $p->comments_count,
                        'shares' => (int) $p->shares_count,
                    ];
                })
                ->values();

            // 8. Audience Demographics (Computed Dynamically from Real User Geography)
            $allAudienceIds = $directFollowerIds->concat($communityMemberIds)->concat($currEngagedUsers)->filter(fn($id) => $id != $userId)->unique()->values();

            $topLocations = [];
            if ($allAudienceIds->isNotEmpty()) {
                $countryCounts = \App\Models\User::whereIn('id', $allAudienceIds)
                    ->whereNotNull('country')
                    ->where('country', '!=', '')
                    ->select('country', DB::raw('COUNT(*) as total'))
                    ->groupBy('country')
                    ->orderByDesc('total')
                    ->take(5)
                    ->get();

                $totalWithCountry = $countryCounts->sum('total');
                if ($totalWithCountry > 0) {
                    $countryCodes = $countryCounts->pluck('country')->map(fn($c) => strtoupper($c))->toArray();
                    $countryNames = \App\Models\Country::whereIn('iso2', $countryCodes)->pluck('name', 'iso2')->toArray();

                    $topLocations = $countryCounts->map(function ($c) use ($countryNames, $totalWithCountry) {
                        $iso = strtoupper($c->country);
                        return [
                            'name' => $countryNames[$iso] ?? $iso,
                            'percentage' => (int) round(($c->total / $totalWithCountry) * 100),
                        ];
                    })->values()->all();
                }
            }

            if (empty($topLocations)) {
                $creatorCountry = $user->country ? strtoupper($user->country) : null;
                if ($creatorCountry) {
                    $cName = \App\Models\Country::where('iso2', $creatorCountry)->value('name') ?? $creatorCountry;
                    $topLocations = [
                        ['name' => $cName, 'percentage' => 100],
                    ];
                } else {
                    $topLocations = [
                        ['name' => 'Worldwide / Unspecified', 'percentage' => 100],
                    ];
                }
            }

            // 9. Audience Retention (Real Returning Engaged Users)
            $priorAudienceIds = DB::table('follows')
                ->where('following_id', $userId)
                ->where('created_at', '<', $startDate)
                ->pluck('follower_id')
                ->concat(
                    DB::table('community_memberships')
                        ->whereIn('community_id', $userCommunityIds)
                        ->where('user_id', '!=', $userId)
                        ->where('created_at', '<', $startDate)
                        ->pluck('user_id')
                )
                ->unique()
                ->toArray();

            $totalActiveEngaged = $currEngagedUsers->count();
            if ($totalActiveEngaged > 0) {
                $returningCount = $currEngagedUsers->filter(fn($id) => in_array($id, $priorAudienceIds))->count();
                $returningPercentage = (int) round(($returningCount / $totalActiveEngaged) * 100);
            } else {
                $returningPercentage = 0;
            }

            // 10. Peak Activity Hours (Computed from Real Hourly Density)
            $reactionTimes = \App\Models\PostReaction::whereIn('post_id', $userPostIds)->where('created_at', '>=', $startDate)->pluck('created_at');
            $commentTimes = \App\Models\PostComment::whereIn('post_id', $userPostIds)->where('created_at', '>=', $startDate)->pluck('created_at');
            $joinTimes = DB::table('community_memberships')->whereIn('community_id', $userCommunityIds)->where('user_id', '!=', $userId)->where('created_at', '>=', $startDate)->pluck('created_at');
            $followTimes = DB::table('follows')->where('following_id', $userId)->where('created_at', '>=', $startDate)->pluck('created_at');

            $allTimestamps = $reactionTimes->concat($commentTimes)->concat($joinTimes)->concat($followTimes);
            if ($allTimestamps->isNotEmpty()) {
                $hourCounts = array_fill(0, 24, 0);
                foreach ($allTimestamps as $ts) {
                    $h = (int) \Carbon\Carbon::parse($ts)->format('H');
                    $hourCounts[$h]++;
                }

                $bestHour = 18;
                $maxCount = -1;
                for ($h = 0; $h < 24; $h++) {
                    $windowCount = $hourCounts[$h] + $hourCounts[($h + 1) % 24] + $hourCounts[($h + 2) % 24];
                    if ($windowCount > $maxCount) {
                        $maxCount = $windowCount;
                        $bestHour = $h;
                    }
                }

                $formatHour = fn($h) => ($h == 0 ? '12 AM' : ($h == 12 ? '12 PM' : ($h > 12 ? ($h - 12) . ' PM' : $h . ' AM')));
                $endHour = ($bestHour + 3) % 24;
                $activityPeak = $formatHour($bestHour) . ' – ' . $formatHour($endHour);
            } else {
                $activityPeak = 'No recent activity';
            }

            // 11. Profile Status & Real Weekly Goal
            $weeklyPosts = \App\Models\Post::where('user_id', $userId)->where('created_at', '>=', $now->copy()->subDays(7))->count();
            $weeklyEngagements = \App\Models\PostReaction::whereIn('post_id', $userPostIds)->where('created_at', '>=', $now->copy()->subDays(7))->count()
                + \App\Models\PostComment::whereIn('post_id', $userPostIds)->where('created_at', '>=', $now->copy()->subDays(7))->count();

            // Weekly target benchmarks: 3 posts and 10 engagements
            $weeklyProgress = min(100, (int) round(($weeklyPosts / 3 * 50) + ($weeklyEngagements / 10 * 50)));

            $engagementRate = $totalViews > 0
                ? round(($allTimeEngagement / $totalViews) * 100, 1) . '%'
                : ($totalFollowers > 0 ? round(($allTimeEngagement / $totalFollowers) * 100, 1) . '%' : '0%');

            // 12. Real Planned Content (Scheduled Posts, Draft Content, Upcoming Events)
            try {
                $plannedPosts = \App\Models\Post::where('user_id', $userId)
                    ->whereNotNull('scheduled_at')
                    ->where('scheduled_at', '>', $now)
                    ->orderBy('scheduled_at')
                    ->take(5)
                    ->get()
                    ->map(fn($p) => [
                        'id' => $p->id,
                        'title' => mb_strimwidth(strip_tags($p->content ?? 'Scheduled Post'), 0, 50, '...'),
                        'date' => $p->scheduled_at?->toIso8601String(),
                        'status' => 'scheduled',
                    ]);
            } catch (\Throwable) {
                $plannedPosts = collect();
            }

            try {
                $plannedItems = \App\Models\ContentItem::where('creator_id', $userId)
                    ->where('status', 'draft')
                    ->latest()
                    ->take(5)
                    ->get()
                    ->map(fn($item) => [
                        'id' => $item->id,
                        'title' => $item->title,
                        'date' => $item->created_at?->toIso8601String(),
                        'status' => 'draft',
                    ]);
            } catch (\Throwable) {
                $plannedItems = collect();
            }

            try {
                $plannedEvents = \App\Models\Event::where('creator_id', $userId)
                    ->where('start_date', '>', $now)
                    ->where('status', 'published')
                    ->orderBy('start_date')
                    ->take(5)
                    ->get()
                    ->map(fn($e) => [
                        'id' => $e->id,
                        'title' => $e->title,
                        'date' => $e->start_date?->toIso8601String(),
                        'status' => 'upcoming_event',
                    ]);
            } catch (\Throwable) {
                $plannedEvents = collect();
            }

            $plannedContent = $plannedPosts->concat($plannedItems)->concat($plannedEvents)->sortBy('date')->take(5)->values();

            return response()->json([
                'data' => [
                    'summary' => [
                        'views' => [
                            'value' => $currPeriodViews,
                            'delta' => $calcDelta($currPeriodViews, $priorPeriodViews),
                        ],
                        'engagement' => [
                            'value' => $totalEngagement,
                            'delta' => $calcDelta($totalEngagement, $priorEngagement),
                        ],
                        'net_follows' => [
                            'value' => $netFollows,
                            'delta' => $calcDelta($netFollows, $priorNetFollows),
                        ],
                        'reach' => [
                            'value' => $reach,
                            'delta' => $calcDelta($reach, $priorReach),
                        ],
                    ],
                    'time_series' => $timeSeries,
                    'top_content' => $topContent,
                    'audience' => [
                        'total_followers' => $totalFollowers,
                        'growth_rate' => $calcDelta($netFollows, $priorNetFollows),
                        'returning_percentage' => $returningPercentage,
                        'top_locations' => $topLocations,
                        'activity_peak' => $activityPeak,
                    ],
                    'profile_status' => [
                        'name' => $user->name,
                        'username' => $user->username,
                        'avatar' => $user->avatar_url ?? $user->avatar,
                        'profile_views' => $totalViews,
                        'followers' => $totalFollowers,
                        'engagement_rate' => $engagementRate,
                        'weekly_progress' => $weeklyProgress,
                    ],
                    'planned_content' => $plannedContent,
                ],
                'success' => true,
                'request_id' => (string) \Illuminate\Support\Str::uuid(),
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('creatorPerformance failed: ' . $e->getMessage(), [
                'exception' => $e,
            ]);

            // Return safe initial structure instead of a hard crash
            $timeSeries = [];
            $now = now();
            $daysCount = match ($request->query('range', '28d')) {
                '7d' => 7,
                '90d' => 90,
                default => 28,
            };
            for ($i = $daysCount - 1; $i >= 0; $i--) {
                $dt = $now->copy()->subDays($i);
                $timeSeries[] = [
                    'date' => $dt->format('Y-m-d'),
                    'label' => $dt->format('M j'),
                    'views' => 0,
                    'engagement' => 0,
                    'net_follows' => 0,
                    'reach' => 0,
                ];
            }

            return response()->json([
                'data' => [
                    'summary' => [
                        'views' => ['value' => 0, 'delta' => 0],
                        'engagement' => ['value' => 0, 'delta' => 0],
                        'net_follows' => ['value' => 0, 'delta' => 0],
                        'reach' => ['value' => 0, 'delta' => 0],
                    ],
                    'time_series' => $timeSeries,
                    'top_content' => [],
                    'audience' => [
                        'total_followers' => 0,
                        'growth_rate' => 0,
                        'returning_percentage' => 0,
                        'top_locations' => [],
                        'activity_peak' => 'No recent activity',
                    ],
                    'profile_status' => [
                        'name' => $user->name,
                        'username' => $user->username,
                        'avatar' => $user->avatar_url ?? $user->avatar,
                        'profile_views' => 0,
                        'followers' => 0,
                        'engagement_rate' => '0%',
                        'weekly_progress' => 0,
                    ],
                    'planned_content' => [],
                ],
                'success' => true,
                'request_id' => (string) \Illuminate\Support\Str::uuid(),
            ]);
        }
    }
}
