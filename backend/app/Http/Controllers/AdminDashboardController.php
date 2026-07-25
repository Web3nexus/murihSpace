<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\DigitalProduct;
use App\Models\Order;
use App\Models\Report;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use Illuminate\Http\JsonResponse;

class AdminDashboardController extends Controller
{
    public function stats(): JsonResponse
    {
        $totalUsers = User::count();
        $activeUsers = User::where('status', 'active')->count();
        $suspendedUsers = User::where('status', 'suspended')->count();
        $pendingKyc = User::where('kyc_status', 'pending')->count();

        $totalProducts = DigitalProduct::count();
        $publishedProducts = DigitalProduct::where('status', 'published')->count();

        $totalOrders = Order::count();
        $completedOrders = Order::where('status', 'completed')->count();
        $revenue = Order::where('status', 'completed')->sum('total');

        $pendingWithdrawals = WithdrawalRequest::where('status', 'pending')->count();
        $pendingReports = Report::where('status', 'pending')->count();

        $platformBalance = Wallet::where('user_id', 1)->value('balance') ?? 0;
        $totalWallets = Wallet::where('user_id', '!=', 1)->sum('balance');

        $recentLogs = AuditLog::with('user:id,name')
            ->latest()
            ->take(10)
            ->get()
            ->map(fn ($l) => [
                'id' => $l->id,
                'action' => $l->action,
                'user_name' => $l->user?->name,
                'created_at' => $l->created_at->diffForHumans(),
            ]);

        return response()->json([
            'data' => [
                'users' => [
                    'total' => $totalUsers,
                    'active' => $activeUsers,
                    'suspended' => $suspendedUsers,
                    'pending_kyc' => $pendingKyc,
                ],
                'store' => [
                    'total_products' => $totalProducts,
                    'published_products' => $publishedProducts,
                ],
                'commerce' => [
                    'total_orders' => $totalOrders,
                    'completed_orders' => $completedOrders,
                    'revenue' => (float) $revenue,
                ],
                'operations' => [
                    'pending_withdrawals' => $pendingWithdrawals,
                    'pending_reports' => $pendingReports,
                ],
                'wallet' => [
                    'platform_balance' => $platformBalance,
                    'user_balances' => $totalWallets,
                ],
                'recent_activity' => $recentLogs,
            ],
        ]);
    }
}
