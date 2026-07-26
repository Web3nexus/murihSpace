<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\DigitalProduct;
use App\Models\Order;
use App\Models\PhysicalProduct;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminAnalyticsController extends Controller
{
    public function overview(): JsonResponse
    {
        $totalUsers = User::count();
        $creators = User::whereIn('role', ['creator', 'vendor'])->count();
        $members = User::where('role', 'member')->count();
        $verifiedKyc = User::where('kyc_status', 'verified')->count();
        $pendingKyc = User::where('kyc_status', 'pending')->count();

        $totalProducts = DigitalProduct::count();
        $publishedProducts = DigitalProduct::where('status', 'published')->count();
        $physicalProducts = PhysicalProduct::count();
        $totalCommunities = Community::count();
        $publicCommunities = Community::where('visibility', 'public')->count();

        $digitalRevenue = Order::where('status', 'completed')->sum('total');
        $digitalOrders = Order::where('status', 'completed')->count();

        $totalSubscriptions = Subscription::count();
        $activeSubscriptions = Subscription::where('status', 'active')
            ->where('current_period_end', '>', now())
            ->count();
        $mrr = Subscription::where('subscriptions.status', 'active')
            ->where('subscriptions.current_period_end', '>', now())
            ->join('subscription_plans', 'subscriptions.plan_id', '=', 'subscription_plans.id')
            ->sum('subscription_plans.price');

        $totalPlans = SubscriptionPlan::count();
        $activePlans = SubscriptionPlan::where('is_active', true)->count();

        $platformBalance = Wallet::where('user_id', 1)->value('balance') ?? 0;
        $totalWallets = Wallet::where('user_id', '!=', 1)->sum('balance');

        return response()->json([
            'users' => [
                'total' => $totalUsers,
                'creators' => $creators,
                'members' => $members,
                'verified_kyc' => $verifiedKyc,
                'pending_kyc' => $pendingKyc,
            ],
            'content' => [
                'digital_products' => $totalProducts,
                'published_products' => $publishedProducts,
                'physical_products' => $physicalProducts,
                'communities' => $totalCommunities,
                'public_communities' => $publicCommunities,
            ],
            'revenue' => [
                'digital_revenue' => (float) $digitalRevenue,
                'digital_orders' => $digitalOrders,
                'mrr' => (float) $mrr,
                'active_subscriptions' => $activeSubscriptions,
                'total_subscriptions' => $totalSubscriptions,
            ],
            'subscriptions' => [
                'total_plans' => $totalPlans,
                'active_plans' => $activePlans,
            ],
            'wallet' => [
                'platform_balance' => $platformBalance,
                'user_balances' => $totalWallets,
            ],
        ]);
    }

    public function trends(Request $request): JsonResponse
    {
        $days = min((int) $request->query('days', 30), 365);

        $userGrowth = User::selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $revenueTrend = Order::selectRaw('DATE(created_at) as date, SUM(total) as revenue, COUNT(*) as orders')
            ->where('status', 'completed')
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $subscriptionTrend = Subscription::selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'user_growth' => $userGrowth,
            'revenue_trend' => $revenueTrend,
            'subscription_trend' => $subscriptionTrend,
        ]);
    }

    public function topContent(): JsonResponse
    {
        $topDigital = DigitalProduct::select('id', 'title', 'price', 'currency', 'status')
            ->selectSub('SELECT COUNT(*) FROM orders WHERE orders.product_id = digital_products.id AND orders.status = \'completed\'', 'sales_count')
            ->where('status', 'published')
            ->orderByDesc('sales_count')
            ->take(10)
            ->get();

        $topCommunities = Community::select('id', 'name', 'slug', 'members_count', 'category')
            ->orderByDesc('members_count')
            ->take(10)
            ->get();

        $topCreators = User::select('id', 'name', 'username', 'role')
            ->whereIn('role', ['creator', 'vendor'])
            ->selectSub('SELECT COUNT(*) FROM digital_products WHERE creator_id = users.id AND status = \'published\'', 'product_count')
            ->selectSub('SELECT COUNT(*) FROM subscription_plans WHERE creator_id = users.id AND is_active = true', 'plan_count')
            ->selectSub('SELECT COUNT(*) FROM subscriptions WHERE creator_id = users.id AND status = \'active\' AND current_period_end > NOW()', 'subscriber_count')
            ->orderByDesc(DB::raw('(SELECT COUNT(*) FROM subscriptions WHERE creator_id = users.id AND status = \'active\' AND current_period_end > NOW())'))
            ->take(10)
            ->get()
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'username' => $u->username,
                'product_count' => (int) ($u->product_count ?? 0),
                'plan_count' => (int) ($u->plan_count ?? 0),
                'subscriber_count' => (int) ($u->subscriber_count ?? 0),
            ]);

        return response()->json([
            'top_digital_products' => $topDigital,
            'top_communities' => $topCommunities,
            'top_creators' => $topCreators,
        ]);
    }
}
