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
}
