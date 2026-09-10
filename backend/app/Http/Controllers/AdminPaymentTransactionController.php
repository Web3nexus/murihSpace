<?php

namespace App\Http\Controllers;

use App\Enums\PaymentStatus;
use App\Models\FinancialAuditLog;
use App\Models\Payment;
use App\Models\Payout;
use App\Models\Refund;
use App\Services\Payment\Contracts\CollectionProviderInterface;
use App\Services\Payment\PaymentService;
use App\Services\Payment\RefundService;
use App\Services\Payment\Router\ProviderRouter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPaymentTransactionController extends Controller
{
    public function __construct(
        protected PaymentService $paymentService,
        protected RefundService $refundService,
        protected ProviderRouter $router
    ) {}

    /**
     * Metrics overview for Admin Dashboard.
     */
    public function stats(): JsonResponse
    {
        $totalProcessed = Payment::where('status', PaymentStatus::Successful)->sum('amount');
        $totalFees = Payment::where('status', PaymentStatus::Successful)->sum('fees');
        $successfulCount = Payment::where('status', PaymentStatus::Successful)->count();
        $failedCount = Payment::where('status', PaymentStatus::Failed)->count();
        $pendingCount = Payment::whereIn('status', [PaymentStatus::Pending, PaymentStatus::Processing])->count();
        $refundedCount = Payment::whereIn('status', [PaymentStatus::Refunded, PaymentStatus::PartiallyRefunded])->count();

        // Provider distribution
        $providerDistribution = Payment::where('status', PaymentStatus::Successful)
            ->selectRaw('provider, count(*) as count, sum(amount) as total_amount')
            ->groupBy('provider')
            ->get();

        // Currency distribution
        $currencyDistribution = Payment::where('status', PaymentStatus::Successful)
            ->selectRaw('currency, count(*) as count, sum(amount) as total_amount')
            ->groupBy('currency')
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'total_volume_minor' => (int) $totalProcessed,
                'total_fees_minor' => (int) $totalFees,
                'net_revenue_minor' => (int) max(0, $totalProcessed - $totalFees),
                'successful_count' => $successfulCount,
                'failed_count' => $failedCount,
                'pending_count' => $pendingCount,
                'refunded_count' => $refundedCount,
                'provider_distribution' => $providerDistribution,
                'currency_distribution' => $currencyDistribution,
            ],
        ]);
    }

    /**
     * Payments listing with filters.
     */
    public function payments(Request $request): JsonResponse
    {
        $query = Payment::with(['customer:id,name,email', 'user:id,name,email']);

        if ($request->filled('provider')) {
            $query->where('provider', $request->query('provider'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('currency')) {
            $query->where('currency', strtoupper($request->query('currency')));
        }
        if ($request->filled('search')) {
            $s = $request->query('search');
            $query->where(function ($q) use ($s) {
                $q->where('public_reference', 'like', "%{$s}%")
                    ->orWhere('provider_reference', 'like', "%{$s}%")
                    ->orWhere('provider_transaction_id', 'like', "%{$s}%");
            });
        }

        $payments = $query->orderBy('id', 'desc')->paginate($request->query('per_page', 25));

        return response()->json(['success' => true, 'data' => $payments]);
    }

    /**
     * Single payment details with attempts and refund history.
     */
    public function showPayment(int $id): JsonResponse
    {
        $payment = Payment::with(['customer', 'user', 'attempts', 'refunds'])->findOrFail($id);

        return response()->json(['success' => true, 'data' => $payment]);
    }

    /**
     * Manual sync / re-verification of payment from provider API.
     */
    public function syncPayment(Request $request, int $id): JsonResponse
    {
        $payment = Payment::findOrFail($id);
        $provider = $this->router->getProvider($payment->provider);

        if (!($provider instanceof CollectionProviderInterface)) {
            return response()->json(['error' => 'Provider does not support verification'], 400);
        }

        $ref = $payment->provider_transaction_id ?: $payment->provider_reference ?: $payment->public_reference;
        $result = $provider->verifyPayment($ref);

        $oldStatus = $payment->status->value;
        $finalized = $this->paymentService->finalizePayment($payment, $result);
        $payment->refresh();

        FinancialAuditLog::create([
            'admin_id' => $request->user()?->id,
            'action' => 'payment_manual_sync',
            'resource_type' => 'payment',
            'resource_id' => (string) $payment->id,
            'old_values' => ['status' => $oldStatus],
            'new_values' => ['status' => $payment->status->value, 'verification' => (array) $result],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'reason' => 'Admin manual transaction sync',
        ]);

        return response()->json([
            'success' => true,
            'message' => "Payment synced. Current status: {$payment->status->value}",
            'data' => $payment,
        ]);
    }

    /**
     * Manual Admin Refund issue.
     */
    public function issueRefund(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'reason' => ['required', 'string', 'max:255'],
        ]);

        $payment = Payment::findOrFail($id);

        $result = $this->refundService->issueRefund([
            'payment_id' => $payment->id,
            'amount' => $validated['amount'],
            'reason' => $validated['reason'],
        ]);

        FinancialAuditLog::create([
            'admin_id' => $request->user()?->id,
            'action' => 'admin_issue_refund',
            'resource_type' => 'refund',
            'resource_id' => (string) ($result['refund_id'] ?? $payment->id),
            'new_values' => $result,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'reason' => $validated['reason'],
        ]);

        return response()->json(['success' => true, 'message' => 'Refund processed.', 'data' => $result]);
    }

    /**
     * Payouts listing.
     */
    public function payouts(Request $request): JsonResponse
    {
        $query = Payout::with(['user:id,name,email', 'destination']);

        if ($request->filled('provider')) {
            $query->where('provider', $request->query('provider'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $payouts = $query->orderBy('id', 'desc')->paginate($request->query('per_page', 25));

        return response()->json(['success' => true, 'data' => $payouts]);
    }

    /**
     * Refunds listing.
     */
    public function refunds(Request $request): JsonResponse
    {
        $query = Refund::with(['payment']);

        if ($request->filled('provider')) {
            $query->where('provider', $request->query('provider'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        $refunds = $query->orderBy('id', 'desc')->paginate($request->query('per_page', 25));

        return response()->json(['success' => true, 'data' => $refunds]);
    }

    /**
     * Financial Audit Logs listing.
     */
    public function auditLogs(Request $request): JsonResponse
    {
        $logs = FinancialAuditLog::with('admin:id,name,email')
            ->orderBy('id', 'desc')
            ->paginate($request->query('per_page', 25));

        return response()->json(['success' => true, 'data' => $logs]);
    }
}

