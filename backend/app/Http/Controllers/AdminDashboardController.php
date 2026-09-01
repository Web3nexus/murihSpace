<?php

namespace App\Http\Controllers;

use App\Models\AccountRoleHistory;
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
        $pendingRoleApplications = AccountRoleHistory::where('status', 'pending')->count();

        $totalProducts = DigitalProduct::count();
        $publishedProducts = DigitalProduct::where('status', 'published')->count();

        $totalOrders = Order::count();
        $completedOrders = Order::where('status', 'completed')->count();
        $revenue = Order::where('status', 'completed')->sum('total');

        $pendingWithdrawals = WithdrawalRequest::where('status', 'pending')->count();
        $pendingReports = Report::where('status', 'pending')->count();

        $platformBalance = Wallet::where('user_id', 1)->value('available') ?? 0;
        $totalWallets = Wallet::where('user_id', '!=', 1)->sum('available');

        $recentLogs = AuditLog::with('user:id,name')
            ->latest()
            ->take(10)
            ->get()
            ->map(fn ($l) => [
                'id' => $l->id,
                'action' => $l->action,
                'user_name' => $l->user?->name,
                'created_at' => $l->created_at?->diffForHumans() ?? 'Just now',
            ]);

        return response()->json([
            'users' => [
                'total' => $totalUsers,
                'active' => $activeUsers,
                'suspended' => $suspendedUsers,
                'pending_kyc' => $pendingKyc,
                'pending_role_applications' => $pendingRoleApplications,
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
                'pending_role_applications' => $pendingRoleApplications,
                'pending_kyc' => $pendingKyc,
            ],
            'wallet' => [
                'platform_balance' => (float) $platformBalance,
                'user_balances' => (float) $totalWallets,
            ],
            'recent_activity' => $recentLogs,
        ]);
    }
}
