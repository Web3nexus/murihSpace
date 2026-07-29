<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\FulfilmentOrder;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminConversionMetricsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $totalUsers = User::count();
        $creators = User::where('role', 'creator')->count();
        $vendors = User::where('role', 'vendor')->count();

        $totalOrders = Order::count() + FulfilmentOrder::count();
        $completedOrders = Order::where('status', 'completed')->count() + FulfilmentOrder::where('status', 'delivered')->count();

        try { $checkoutStarts = DB::table('payment_webhooks')->count(); } catch (\Exception $e) { $checkoutStarts = Order::count(); }
        $checkoutCompleted = Order::count();

        return response()->json([
            'data' => [
                'funnel' => [
                    'visitors' => $totalUsers,
                    'signups' => $totalUsers,
                    'creators' => $creators,
                    'vendors' => $vendors,
                    'first_order' => $totalOrders,
                    'repeat_order' => 0,
                ],
                'conversion_rates' => [
                    'signup_to_creator' => $totalUsers > 0 ? round(($creators / $totalUsers) * 100, 1) : 0,
                    'creator_to_seller' => $vendors > 0 ? round(($vendors / $creators) * 100, 1) : 0,
                    'checkout_completion' => $checkoutStarts > 0 ? round(($checkoutCompleted / $checkoutStarts) * 100, 1) : 0,
                    'order_completion' => $totalOrders > 0 ? round(($completedOrders / $totalOrders) * 100, 1) : 0,
                ],
                'totals' => [
                    'total_users' => $totalUsers,
                    'total_creators' => $creators,
                    'total_vendors' => $vendors,
                    'total_orders' => $totalOrders,
                    'completed_orders' => $completedOrders,
                ],
            ],
        ]);
    }
}
