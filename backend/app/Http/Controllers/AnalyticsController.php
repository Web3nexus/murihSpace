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

        $digital = DigitalProduct::where('creator_id', $userId)
            ->get()
            ->map(fn($p) => [
                'name' => $p->title,
                'type' => 'digital',
                'orders' => Order::where('product_id', $p->id)->count(),
                'revenue' => Order::where('product_id', $p->id)->where('status', 'completed')->sum('total'),
            ])
            ->filter(fn($p) => $p['orders'] > 0)
            ->sortByDesc('orders')
            ->values()
            ->take(5);

        $physical = PhysicalProduct::where('creator_id', $userId)
            ->get()
            ->map(fn($p) => [
                'name' => $p->title,
                'type' => 'physical',
                'orders' => DB::table('fulfilment_order_items')->where('physical_product_id', $p->id)->count(),
                'revenue' => DB::table('fulfilment_order_items')->where('physical_product_id', $p->id)->sum('unit_price'),
            ])
            ->filter(fn($p) => $p['orders'] > 0)
            ->sortByDesc('orders')
            ->values()
            ->take(5);

        return response()->json(['data' => $digital->concat($physical)->sortByDesc('orders')->values()]);
    }

    public function aiSuggestions(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $totalProducts = DigitalProduct::where('creator_id', $userId)->count();
        $totalFollowers = DB::table('community_members')
            ->join('communities', 'community_members.community_id', '=', 'communities.id')
            ->where('communities.user_id', $userId)
            ->where('community_members.role', '!=', 'owner')
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

        // Generate content ideas
        $contentIdeas = [
            [
                'platform' => 'Social',
                'idea' => 'Behind-the-scenes: Share how you created your latest product.',
            ],
            [
                'platform' => 'Email',
                'idea' => 'Weekly tip: Share one actionable insight your audience can use today.',
            ],
            [
                'platform' => 'Community',
                'idea' => 'Polls & Questions: Ask your audience what they want to learn next.',
            ],
            [
                'platform' => 'Store',
                'idea' => 'Bundle offer: Combine two popular products at a discount.',
            ],
        ];

        return response()->json([
            'data' => [
                'suggestions' => $suggestions,
                'content_ideas' => $contentIdeas,
            ],
        ]);
    }

    public function productPerformance(Request $request): JsonResponse
    {
        return response()->json(['message' => 'Not implemented.'], 501);
    }

    public function chatChannels(Request $request): JsonResponse
    {
        return response()->json(['message' => 'Not implemented.'], 501);
    }

    public function contentPlanner(Request $request): JsonResponse
    {
        return response()->json(['message' => 'Not implemented.'], 501);
    }

    public function communityActivity(Request $request): JsonResponse
    {
        return response()->json(['message' => 'Not implemented.'], 501);
    }
}
