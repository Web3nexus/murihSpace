<?php

namespace App\Http\Controllers;

use App\Models\FulfilmentPayout;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FulfilmentPayoutController extends Controller
{
    public function __construct(private readonly NotificationService $notifications)
    {
    }
    public function myPayouts(Request $request): JsonResponse
    {
        $payouts = FulfilmentPayout::where('creator_id', $request->user()->id)
            ->with(['fulfilmentOrder:id,order_number,status,created_at'])
            ->latest()
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'fulfilment_order_id' => $p->fulfilment_order_id,
                'order_number' => $p->fulfilmentOrder?->order_number,
                'gross_amount' => $p->gross_amount,
                'platform_fee' => $p->platform_fee,
                'net_amount' => $p->net_amount,
                'currency' => $p->currency,
                'status' => $p->status,
                'paid_at' => $p->paid_at?->toIso8601String(),
                'created_at' => $p->created_at->toIso8601String(),
                'order_created_at' => $p->fulfilmentOrder?->created_at?->toIso8601String(),
            ]);

        $totals = [
            'total_gross' => $payouts->sum('gross_amount'),
            'total_fees' => $payouts->sum('platform_fee'),
            'total_net' => $payouts->sum('net_amount'),
            'pending' => $payouts->where('status', 'pending')->sum('net_amount'),
            'paid' => $payouts->where('status', 'paid')->sum('net_amount'),
        ];

        return response()->json(['data' => $payouts, 'totals' => $totals]);
    }

    public function stats(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $pending = FulfilmentPayout::where('creator_id', $userId)
            ->where('status', 'pending')
            ->sum('net_amount');

        $paid = FulfilmentPayout::where('creator_id', $userId)
            ->where('status', 'paid')
            ->sum('net_amount');

        $totalOrders = FulfilmentPayout::where('creator_id', $userId)->count();

        return response()->json([
            'data' => [
                'pending' => $pending,
                'paid' => $paid,
                'total_orders' => $totalOrders,
            ],
        ]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $query = FulfilmentPayout::with([
            'creator:id,name,username',
            'fulfilmentOrder:id,order_number,status,total,currency',
        ])->latest();

        if ($status) $query->where('status', $status);

        $payouts = $query->paginate(50);

        $summary = [
            'total_pending' => FulfilmentPayout::where('status', 'pending')->sum('net_amount'),
            'total_paid' => FulfilmentPayout::where('status', 'paid')->sum('net_amount'),
            'total_failed' => FulfilmentPayout::where('status', 'failed')->sum('net_amount'),
            'pending_count' => FulfilmentPayout::where('status', 'pending')->count(),
            'paid_count' => FulfilmentPayout::where('status', 'paid')->count(),
        ];

        return response()->json(['data' => $payouts, 'summary' => $summary]);
    }

    public function adminMarkPaid(int $id): JsonResponse
    {
        $payout = FulfilmentPayout::findOrFail($id);

        if ($payout->status !== 'pending') {
            return response()->json(['message' => 'Payout is not pending.'], 400);
        }

        $creator = $payout->creator;
        if (! $creator || ! $creator->hasVerifiedKyc()) {
            return response()->json([
                'message' => 'This creator has not completed KYC identity verification. Payouts are blocked until KYC is verified.',
                'code' => 'KYC_REQUIRED',
            ], 403);
        }

        $payout->update([
            'status' => 'paid',
            'paid_at' => now(),
        ]);

        $this->notifications->actionEmail(
            user: $creator,
            title: 'Your payout has been paid',
            bodyHtml: '<p>Your MurihSpace payout of <strong>'.e($payout->currency ?? 'USD').' '.number_format((float) $payout->net_amount, 2).'</strong> has been <strong>paid</strong> and is on its way to your account.</p>',
            actionLabel: 'View payouts',
            actionUrl: NotificationService::link('settings/payouts'),
            template: 'fulfilment_payout_paid',
            data: [
                'currency' => e($payout->currency ?? 'USD'),
                'amount' => number_format((float) $payout->net_amount, 2),
            ],
        );

        return response()->json(['data' => $payout->fresh()->load('creator:id,name,username')]);
    }
}
