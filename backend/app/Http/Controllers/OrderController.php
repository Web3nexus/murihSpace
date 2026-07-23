<?php

namespace App\Http\Controllers;

use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    /**
     * List the authenticated user's purchase history (as buyer).
     */
    public function myOrders(Request $request): JsonResponse
    {
        $orders = Order::where('buyer_id', $request->user()->id)
            ->with(['product:id,title,slug,cover_url,category', 'creator:id,name,username'])
            ->latest()
            ->get();

        return response()->json(['data' => $orders]);
    }

    /**
     * List the authenticated creator's sales (as seller).
     */
    public function creatorSales(Request $request): JsonResponse
    {
        $orders = Order::where('creator_id', $request->user()->id)
            ->with(['product:id,title,slug,cover_url,category', 'buyer:id,name,username'])
            ->latest()
            ->get()
            ->map(function ($order) {
                return [
                    'id'           => $order->id,
                    'order_number' => $order->order_number,
                    'status'       => $order->status,
                    'subtotal'     => $order->subtotal,
                    'platform_fee' => $order->platform_fee,
                    'net_payout'   => round((float) $order->subtotal - (float) $order->platform_fee, 2),
                    'total'        => $order->total,
                    'currency'     => $order->currency,
                    'paid_at'      => $order->paid_at,
                    'product'      => $order->product,
                    'buyer'        => $order->buyer,
                ];
            });

        return response()->json(['data' => $orders]);
    }

    /**
     * Get full order receipt.
     */
    public function receipt(Request $request, int $id): JsonResponse
    {
        $userId = $request->user()->id;

        // Buyers and Creators can access their order receipts
        $order = Order::where('id', $id)
            ->where(function ($query) use ($userId) {
                $query->where('buyer_id', $userId)->orWhere('creator_id', $userId);
            })
            ->with(['product:id,title,slug,cover_url,category,file_original_name', 'buyer:id,name,username', 'creator:id,name,username'])
            ->firstOrFail();

        return response()->json([
            'data' => [
                'order_number'  => $order->order_number,
                'status'        => $order->status,
                'subtotal'      => $order->subtotal,
                'platform_fee'  => $order->platform_fee,
                'total'         => $order->total,
                'currency'      => $order->currency,
                'payment_provider' => $order->payment_provider,
                'paid_at'       => $order->paid_at?->toIso8601String(),
                'created_at'    => $order->created_at->toIso8601String(),
                'product'       => $order->product,
                'buyer'         => $order->buyer,
                'creator'       => $order->creator,
                'download_url'  => $order->status === 'completed'
                    ? url("/api/v1/products/{$order->product_id}/download")
                    : null,
            ],
        ]);
    }

    /**
     * Admin: inspect all payment orders.
     */
    public function adminIndex(Request $request): JsonResponse
    {
        $orders = Order::with(['product:id,title,slug', 'buyer:id,name,username', 'creator:id,name,username'])
            ->latest()
            ->paginate(50);

        return response()->json($orders);
    }
}
