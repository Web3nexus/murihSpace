<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\Escrow;
use App\Models\FulfilmentOrder;
use App\Models\FulfilmentOrderItem;
use App\Models\FulfilmentPayout;
use App\Models\ShippingProfile;
use App\Models\TrackingEvent;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class FulfilmentOrderController extends Controller
{
    public const PLATFORM_FEE_RATE = 0.05;

    public function __construct(
        private LedgerService $ledgerService,
    ) {}

    public function checkout(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shipping_address_id' => ['required', 'integer', 'exists:addresses,id'],
            'shipping_profile_id' => ['nullable', 'integer', 'exists:shipping_profiles,id'],
        ]);

        $userId = $request->user()->id;

        $cart = Cart::where('user_id', $userId)->with('items.physicalProduct')->first();

        if (! $cart || $cart->items->isEmpty()) {
            return response()->json(['message' => 'Cart is empty.'], 400);
        }

        $address = \App\Models\Address::where('user_id', $userId)
            ->findOrFail($validated['shipping_address_id']);

        $errors = [];
        $subtotal = 0;

        foreach ($cart->items as $item) {
            $product = $item->physicalProduct;
            if (! $product) {
                $errors[] = "Product #{$item->physical_product_id} is no longer available.";
                continue;
            }
            if (! $product->is_active) {
                $errors[] = "{$product->title} is no longer available.";
                continue;
            }
            if ($product->track_inventory && $product->stock_quantity < $item->quantity) {
                $errors[] = "Insufficient stock for {$product->title}. Only {$product->stock_quantity} available (requested {$item->quantity}).";
                continue;
            }
            $subtotal += $product->price * $item->quantity;
        }

        if (! empty($errors)) {
            return response()->json(['message' => 'Some items cannot be checked out.', 'errors' => $errors], 409);
        }

        $creatorIds = $cart->items->pluck('physicalProduct.creator_id')->unique();
        if ($creatorIds->count() > 1) {
            return response()->json(['message' => 'All items must be from the same creator.'], 400);
        }

        $creatorId = $creatorIds->first();
        $itemCount = $cart->items->sum('quantity');

        // Calculate shipping cost
        $shippingCost = 0;
        if (isset($validated['shipping_profile_id'])) {
            $profile = ShippingProfile::where('creator_id', $creatorId)
                ->where('id', $validated['shipping_profile_id'])
                ->active()
                ->first();
            if ($profile) {
                $shippingCost = $profile->calculateCost($itemCount);
            }
        }

        $platformFee = (int) round($subtotal * self::PLATFORM_FEE_RATE);
        $total = $subtotal + $shippingCost + $platformFee;

        $order = DB::transaction(function () use ($userId, $creatorId, $address, $cart, $subtotal, $shippingCost, $platformFee, $total) {
            $order = FulfilmentOrder::create([
                'buyer_id' => $userId,
                'shipping_address_id' => $address->id,
                'order_number' => $this->generateOrderNumber(),
                'subtotal' => $subtotal,
                'shipping_cost' => $shippingCost,
                'platform_fee' => $platformFee,
                'total' => $total,
                'currency' => 'NGN',
                'status' => 'pending',
            ]);

            foreach ($cart->items as $item) {
                $product = $item->physicalProduct;
                FulfilmentOrderItem::create([
                    'fulfilment_order_id' => $order->id,
                    'physical_product_id' => $product->id,
                    'quantity' => $item->quantity,
                    'unit_price' => $product->price,
                    'currency' => $product->currency,
                ]);

                if ($product->track_inventory) {
                    $product->decrement('stock_quantity', $item->quantity);
                }
            }

            $cart->items()->delete();

            $this->createTrackingEvent($order, 'order_placed', null, 'Order placed successfully.');

            Escrow::create([
                'fulfilment_order_id' => $order->id,
                'buyer_id' => $userId,
                'seller_id' => $creatorId,
                'amount' => $total - $platformFee,
                'currency' => 'NGN',
                'status' => 'held',
                'release_window_days' => 7,
            ]);

            return $order;
        });

        $order->load(['items.physicalProduct.creator:id,name,username', 'shippingAddress']);

        return response()->json([
            'message' => 'Order placed successfully.',
            'data' => $this->formatOrder($order),
        ], 201);
    }

    public function myOrders(Request $request): JsonResponse
    {
        $orders = FulfilmentOrder::where('buyer_id', $request->user()->id)
            ->with(['items.physicalProduct:id,title,price,currency,images,sku', 'shippingAddress'])
            ->latest()
            ->get()
            ->map(fn ($o) => $this->formatOrder($o));

        return response()->json(['data' => $orders]);
    }

    public function sales(Request $request): JsonResponse
    {
        $creatorId = $request->user()->id;

        $orders = FulfilmentOrder::whereHas('items.physicalProduct', fn ($q) => $q->where('creator_id', $creatorId))
            ->with(['items.physicalProduct', 'buyer:id,name,username', 'shippingAddress'])
            ->latest()
            ->get()
            ->map(fn ($o) => [
                ...$this->formatOrder($o),
                'buyer' => $o->buyer,
                'net_payout' => $o->subtotal - $o->platform_fee,
            ]);

        return response()->json(['data' => $orders]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $userId = $request->user()->id;

        $order = FulfilmentOrder::where('id', $id)
            ->where(function ($q) use ($userId) {
                $q->where('buyer_id', $userId)
                  ->orWhereHas('items.physicalProduct', fn ($q2) => $q2->where('creator_id', $userId));
            })
            ->with(['items.physicalProduct.creator:id,name,username', 'shippingAddress', 'buyer:id,name,username'])
            ->firstOrFail();

        return response()->json(['data' => $this->formatOrder($order)]);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:confirmed,processing,shipped,delivered,cancelled'],
            'tracking_number' => ['nullable', 'string', 'max:255'],
            'carrier' => ['nullable', 'string', 'max:100'],
            'estimated_delivery' => ['nullable', 'date:Y-m-d'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $creatorId = $request->user()->id;

        $order = FulfilmentOrder::whereHas('items.physicalProduct', fn ($q) => $q->where('creator_id', $creatorId))
            ->findOrFail($id);

        $transition = $this->getStatusTransition($order->status, $validated['status']);
        if (! $transition) {
            return response()->json([
                'message' => "Cannot transition from '{$order->status}' to '{$validated['status']}'.",
            ], 422);
        }

        $update = ['status' => $validated['status']];
        $eventName = $validated['status'];
        $eventDesc = '';

        if ($validated['status'] === 'shipped') {
            $update['tracking_number'] = $validated['tracking_number'] ?? $order->tracking_number;
            $update['carrier'] = $validated['carrier'] ?? $order->carrier;
            $update['estimated_delivery'] = $validated['estimated_delivery'] ?? $order->estimated_delivery;
            $update['shipped_at'] = now();
            $eventDesc = 'Package has been shipped' . ($update['carrier'] ? ' via ' . $update['carrier'] : '') . '.';
        }

        if ($validated['status'] === 'delivered') {
            $update['delivered_at'] = now();
            $eventDesc = 'Package has been delivered.';
            $this->releaseEscrow($order);
            $this->createPayout($order);
        }

        if ($validated['status'] === 'cancelled') {
            $this->restoreStock($order);
            $eventDesc = 'Order has been cancelled.';
            $this->refundEscrow($order);
        }

        if ($validated['status'] === 'confirmed') {
            $eventDesc = 'Order has been confirmed.';
        }

        if ($validated['status'] === 'processing') {
            $eventDesc = 'Order is being prepared.';
        }

        if (isset($validated['notes'])) {
            $update['notes'] = $validated['notes'];
        }

        $order->update($update);

        if ($eventDesc) {
            $this->createTrackingEvent($order, $eventName, null, $eventDesc);
        }

        $order->load(['items.physicalProduct', 'shippingAddress']);

        return response()->json([
            'message' => "Order status updated to '{$validated['status']}'.",
            'data' => $this->formatOrder($order),
        ]);
    }

    public function updateTracking(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'tracking_number' => ['required', 'string', 'max:255'],
            'carrier' => ['nullable', 'string', 'max:100'],
        ]);

        $creatorId = $request->user()->id;

        $order = FulfilmentOrder::whereHas('items.physicalProduct', fn ($q) => $q->where('creator_id', $creatorId))
            ->whereIn('status', ['processing', 'shipped'])
            ->findOrFail($id);

        $order->update([
            'tracking_number' => $validated['tracking_number'],
            'carrier' => $validated['carrier'] ?? $order->carrier,
        ]);

        return response()->json([
            'message' => 'Tracking info updated.',
            'data' => $this->formatOrder($order),
        ]);
    }

    public function trackingEvents(Request $request, int $id): JsonResponse
    {
        $userId = $request->user()->id;

        $order = FulfilmentOrder::where('id', $id)
            ->where(function ($q) use ($userId) {
                $q->where('buyer_id', $userId)
                  ->orWhereHas('items.physicalProduct', fn ($q2) => $q2->where('creator_id', $userId));
            })
            ->firstOrFail();

        $events = TrackingEvent::where('fulfilment_order_id', $order->id)
            ->orderBy('occurred_at')
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'event' => $e->event,
                'location' => $e->location,
                'description' => $e->description,
                'occurred_at' => $e->occurred_at->toIso8601String(),
            ]);

        return response()->json(['data' => $events]);
    }

    private function createTrackingEvent(FulfilmentOrder $order, string $event, ?string $location, ?string $description): TrackingEvent
    {
        return TrackingEvent::create([
            'fulfilment_order_id' => $order->id,
            'event' => $event,
            'location' => $location,
            'description' => $description,
            'occurred_at' => now(),
        ]);
    }

    private function releaseEscrow(FulfilmentOrder $order): void
    {
        $escrow = Escrow::where('fulfilment_order_id', $order->id)
            ->where('status', 'held')
            ->first();

        if (! $escrow) return;

        DB::transaction(function () use ($escrow) {
            $netAmount = $escrow->amount;
            $txn = $this->ledgerService->credit(
                $escrow->seller_id,
                $netAmount,
                $escrow->currency,
                'escrow_release',
                "Escrow release for fulfilment order #{$escrow->fulfilment_order_id}",
                ['fulfilment_order_id' => $escrow->fulfilment_order_id],
            );

            $escrow->update([
                'status' => 'released',
                'released_at' => now(),
                'ledger_transaction_id' => $txn->id,
            ]);
        });
    }

    private function refundEscrow(FulfilmentOrder $order): void
    {
        $escrow = Escrow::where('fulfilment_order_id', $order->id)
            ->where('status', 'held')
            ->first();

        if (! $escrow) return;

        $escrow->update(['status' => 'refunded']);
    }

    private function createPayout(FulfilmentOrder $order): void
    {
        $netAmount = $order->total - $order->platform_fee;
        $escrow = Escrow::where('fulfilment_order_id', $order->id)->first();
        $creatorId = $escrow?->seller_id ?? $order->items->first()?->physicalProduct?->creator_id;

        if (! $creatorId) return;

        FulfilmentPayout::create([
            'creator_id' => $creatorId,
            'fulfilment_order_id' => $order->id,
            'gross_amount' => $netAmount,
            'platform_fee' => $order->platform_fee,
            'net_amount' => $netAmount,
            'currency' => $order->currency,
            'status' => 'pending',
        ]);

        $this->createTrackingEvent($order, 'delivered', null, 'Funds released to creator.');
    }

    private function getStatusTransition(string $from, string $to): bool
    {
        $allowed = [
            'pending' => ['confirmed'],
            'confirmed' => ['processing', 'cancelled'],
            'processing' => ['shipped', 'cancelled'],
            'shipped' => ['delivered'],
        ];

        return isset($allowed[$from]) && in_array($to, $allowed[$from]);
    }

    private function restoreStock(FulfilmentOrder $order): void
    {
        foreach ($order->items as $item) {
            if ($item->physicalProduct && $item->physicalProduct->track_inventory) {
                $item->physicalProduct->increment('stock_quantity', $item->quantity);
            }
        }
    }

    private function generateOrderNumber(): string
    {
        return 'FO-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
    }

    private function formatOrder(FulfilmentOrder $order): array
    {
        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'status' => $order->status,
            'subtotal' => $order->subtotal,
            'shipping_cost' => $order->shipping_cost,
            'platform_fee' => $order->platform_fee,
            'total' => $order->total,
            'currency' => $order->currency,
            'tracking_number' => $order->tracking_number,
            'carrier' => $order->carrier,
            'estimated_delivery' => $order->estimated_delivery?->toDateString(),
            'shipped_at' => $order->shipped_at?->toIso8601String(),
            'delivered_at' => $order->delivered_at?->toIso8601String(),
            'notes' => $order->notes,
            'created_at' => $order->created_at->toIso8601String(),
            'items' => $order->items->map(fn ($item) => [
                'id' => $item->id,
                'product_id' => $item->physical_product_id,
                'quantity' => $item->quantity,
                'unit_price' => $item->unit_price,
                'currency' => $item->currency,
                'product' => $item->physicalProduct ? [
                    'id' => $item->physicalProduct->id,
                    'title' => $item->physicalProduct->title,
                    'sku' => $item->physicalProduct->sku,
                    'price' => $item->physicalProduct->price,
                    'images' => $item->physicalProduct->images,
                ] : null,
            ]),
            'shipping_address' => $order->shippingAddress,
            'buyer' => $order->relationLoaded('buyer') ? $order->buyer : null,
            'payout' => $order->relationLoaded('payout') ? [
                'id' => $order->payout->id,
                'gross_amount' => $order->payout->gross_amount,
                'net_amount' => $order->payout->net_amount,
                'status' => $order->payout->status,
                'paid_at' => $order->payout->paid_at?->toIso8601String(),
            ] : null,
        ];
    }
}
