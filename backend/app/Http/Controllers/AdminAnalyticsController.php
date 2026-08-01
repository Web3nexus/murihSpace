<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
use App\Models\Community;
use App\Models\DigitalProduct;
use App\Models\FulfilmentPayout;
use App\Models\Order;
use App\Models\PhysicalProduct;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\Wallet;
use App\Services\CurrencyConverter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminAnalyticsController extends Controller
{
    public function __construct(
        private readonly CurrencyConverter $converter,
    ) {}

    private function resolveCurrency(Request $request): string
    {
        $requested = strtoupper((string) $request->query('currency', ''));
        if (in_array($requested, $this->converter->getSupportedCurrencies(), true)) {
            return $requested;
        }

        $default = strtoupper((string) AdminSetting::get('default_currency', 'NGN'));
        return in_array($default, $this->converter->getSupportedCurrencies(), true)
            ? $default
            : 'NGN';
    }

    /**
     * Convert an NGN minor-unit amount into the target currency (minor units).
     */
    private function convertAmount(int|float $ngnMinorUnits, string $to): float
    {
        if ($to === 'NGN') {
            return (float) round((float) $ngnMinorUnits, 2);
        }

        $rate = $this->converter->getRate('NGN', $to);
        if ($rate === null) {
            return (float) round((float) $ngnMinorUnits, 2);
        }

        return (float) round((float) $ngnMinorUnits * $rate, 2);
    }

    public function overview(Request $request): JsonResponse
    {
        $currency = $this->resolveCurrency($request);
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
            'currency' => $currency,
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
                'digital_revenue' => $this->convertAmount($digitalRevenue, $currency),
                'digital_orders' => $digitalOrders,
                'mrr' => $this->convertAmount($mrr, $currency),
                'active_subscriptions' => $activeSubscriptions,
                'total_subscriptions' => $totalSubscriptions,
            ],
            'subscriptions' => [
                'total_plans' => $totalPlans,
                'active_plans' => $activePlans,
            ],
            'wallet' => [
                'platform_balance' => $this->convertAmount($platformBalance, $currency),
                'user_balances' => $this->convertAmount($totalWallets, $currency),
            ],
        ]);
    }

    public function trends(Request $request): JsonResponse
    {
        $currency = $this->resolveCurrency($request);
        $days = max(1, min((int) $request->query('days', 30), 365));

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
            ->get()
            ->map(fn ($row) => [
                'date' => $row->date,
                'revenue' => $this->convertAmount((float) $row->revenue, $currency),
                'orders' => (int) $row->orders,
            ]);

        $subscriptionTrend = Subscription::selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        return response()->json([
            'currency' => $currency,
            'user_growth' => $userGrowth,
            'revenue_trend' => $revenueTrend,
            'subscription_trend' => $subscriptionTrend,
        ]);
    }

    public function topContent(Request $request): JsonResponse
    {
        $currency = $this->resolveCurrency($request);

        $topDigital = DigitalProduct::select('id', 'title', 'price', 'currency', 'status')
            ->selectSub('SELECT COUNT(*) FROM orders WHERE orders.product_id = digital_products.id AND orders.status = \'completed\'', 'sales_count')
            ->where('status', 'published')
            ->orderByDesc('sales_count')
            ->take(10)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'title' => $p->title,
                'price' => $this->convertAmount((float) $p->price, $currency),
                'currency' => $currency,
                'status' => $p->status,
                'sales_count' => (int) ($p->sales_count ?? 0),
            ]);

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
            'currency' => $currency,
            'top_digital_products' => $topDigital,
            'top_communities' => $topCommunities,
            'top_creators' => $topCreators,
        ]);
    }

    public function growth(Request $request): JsonResponse
    {
        $currency = $this->resolveCurrency($request);
        $days = max(1, min((int) $request->query('days', 30), 365));

        $totalUsers = User::count();
        $newUsers30d = User::where('created_at', '>=', now()->subDays(30))->count();
        $activeCreators = User::whereIn('role', ['creator', 'vendor'])->count();

        $gmv30d = Order::where('status', 'completed')
            ->where('created_at', '>=', now()->subDays(30))
            ->sum('total');

        $signupsByDay = User::selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date')
            ->get();

        $roleBreakdown = User::selectRaw('role, COUNT(*) as count')
            ->groupBy('role')
            ->get();

        $kycStats = [
            'verified' => User::where('kyc_status', 'verified')->count(),
            'pending' => User::where('kyc_status', 'pending')->count(),
            'none' => User::whereNull('kyc_status')->orWhere('kyc_status', '')->count(),
        ];

        return response()->json([
            'currency' => $currency,
            'total_users' => $totalUsers,
            'new_users_30d' => $newUsers30d,
            'active_creators' => $activeCreators,
            'gmv_30d' => $this->convertAmount($gmv30d, $currency),
            'signups_by_day' => $signupsByDay,
            'role_breakdown' => $roleBreakdown,
            'kyc_stats' => $kycStats,
        ]);
    }

    public function revenue(Request $request): JsonResponse
    {
        $currency = $this->resolveCurrency($request);
        $days = max(1, min((int) $request->query('days', 30), 365));

        $digitalRevenue = Order::where('status', 'completed')->sum('total');
        $digitalOrders = Order::where('status', 'completed')->count();

        $mrr = Subscription::where('subscriptions.status', 'active')
            ->where('subscriptions.current_period_end', '>', now())
            ->join('subscription_plans', 'subscriptions.plan_id', '=', 'subscription_plans.id')
            ->sum('subscription_plans.price');

        $activeSubscriptions = Subscription::where('status', 'active')
            ->where('current_period_end', '>', now())
            ->count();

        $platformFees = Order::where('status', 'completed')->sum('platform_fee');

        $pendingPayouts = FulfilmentPayout::where('status', 'pending')->sum('net_amount');

        $revenueTrend = Order::selectRaw("TO_CHAR(created_at, 'YYYY-MM') as month, SUM(total) as revenue, COUNT(*) as orders")
            ->where('status', 'completed')
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->map(fn ($row) => [
                'month' => $row->month,
                'revenue' => $this->convertAmount((float) $row->revenue, $currency),
                'orders' => (int) $row->orders,
            ]);

        return response()->json([
            'currency' => $currency,
            'digital_revenue' => $this->convertAmount($digitalRevenue, $currency),
            'digital_orders' => $digitalOrders,
            'mrr' => $this->convertAmount($mrr, $currency),
            'active_subscriptions' => $activeSubscriptions,
            'platform_fees' => $this->convertAmount($platformFees, $currency),
            'pending_payouts' => $this->convertAmount($pendingPayouts, $currency),
            'revenue_by_source' => [
                'digital' => $this->convertAmount($digitalRevenue, $currency),
                'subscriptions' => $this->convertAmount($mrr, $currency),
            ],
            'revenue_trend' => $revenueTrend,
        ]);
    }
}
