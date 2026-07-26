<?php

namespace App\Http\Controllers;

use App\Models\FulfilmentDispute;
use App\Models\FulfilmentOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FulfilmentDisputeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $disputes = FulfilmentDispute::where('raised_by', $userId)
            ->with(['fulfilmentOrder:id,order_number,status,total,currency', 'fulfilmentOrder.items.physicalProduct:id,title,images'])
            ->latest()
            ->get()
            ->map(fn ($d) => $this->format($d));

        return response()->json(['data' => $disputes]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fulfilment_order_id' => ['required', 'integer', 'exists:fulfilment_orders,id'],
            'subject' => ['required', 'in:not_received,damaged,wrong_item,defective,not_as_described,other'],
            'description' => ['required', 'string', 'min:10', 'max:5000'],
        ]);

        $userId = $request->user()->id;

        $order = FulfilmentOrder::where('id', $validated['fulfilment_order_id'])
            ->where('buyer_id', $userId)
            ->firstOrFail();

        if (! in_array($order->status, ['delivered', 'shipped'])) {
            return response()->json([
                'message' => 'You can only dispute delivered or shipped orders.',
            ], 422);
        }

        $existing = FulfilmentDispute::where('fulfilment_order_id', $order->id)
            ->whereIn('status', ['open', 'under_review'])
            ->exists();

        if ($existing) {
            return response()->json(['message' => 'An active dispute already exists for this order.'], 409);
        }

        $dispute = FulfilmentDispute::create([
            'fulfilment_order_id' => $order->id,
            'raised_by' => $userId,
            'subject' => $validated['subject'],
            'description' => $validated['description'],
            'status' => 'open',
        ]);

        $dispute->load('fulfilmentOrder:id,order_number');

        return response()->json(['data' => $this->format($dispute)], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $userId = $request->user()->id;

        $dispute = FulfilmentDispute::where('id', $id)
            ->where(function ($q) use ($userId) {
                $q->where('raised_by', $userId)
                  ->orWhereHas('fulfilmentOrder.items.physicalProduct', fn ($q2) => $q2->where('creator_id', $userId));
            })
            ->with([
                'fulfilmentOrder:id,order_number,status,total,currency,created_at',
                'fulfilmentOrder.items.physicalProduct:id,title,images,sku',
                'fulfilmentOrder.shippingAddress',
                'raisedBy:id,name,username',
                'resolvedBy:id,name,username',
            ])
            ->firstOrFail();

        return response()->json(['data' => $this->format($dispute)]);
    }

    public function resolve(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'resolution' => ['required', 'in:resolved,dismissed'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $userId = $request->user()->id;

        $dispute = FulfilmentDispute::whereIn('status', ['open', 'under_review'])
            ->whereHas('fulfilmentOrder.items.physicalProduct', fn ($q) => $q->where('creator_id', $userId))
            ->orWhereHas('fulfilmentOrder', fn ($q) => $q->where('buyer_id', $userId))
            ->findOrFail($id);

        $dispute->update([
            'status' => $validated['resolution'],
            'resolution' => $validated['note'] ?? null,
            'resolved_by' => $userId,
            'resolved_at' => now(),
        ]);

        return response()->json(['data' => $this->format($dispute)]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $disputes = FulfilmentDispute::with([
            'fulfilmentOrder:id,order_number,status,total,currency,buyer_id',
            'fulfilmentOrder.buyer:id,name,username',
            'fulfilmentOrder.items.physicalProduct:id,title',
            'raisedBy:id,name,username',
        ])
            ->latest()
            ->get()
            ->map(fn ($d) => $this->format($d));

        return response()->json(['data' => $disputes]);
    }

    public function adminResolve(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'resolution' => ['required', 'in:resolved,dismissed'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $dispute = FulfilmentDispute::findOrFail($id);

        $dispute->update([
            'status' => $validated['resolution'],
            'resolution' => $validated['note'] ?? null,
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        return response()->json(['data' => $this->format($dispute)]);
    }

    private function format(FulfilmentDispute $dispute): array
    {
        return [
            'id' => $dispute->id,
            'fulfilment_order_id' => $dispute->fulfilment_order_id,
            'subject' => $dispute->subject,
            'subject_label' => match ($dispute->subject) {
                'not_received' => 'Not Received',
                'damaged' => 'Damaged',
                'wrong_item' => 'Wrong Item',
                'defective' => 'Defective',
                'not_as_described' => 'Not as Described',
                'other' => 'Other',
                default => $dispute->subject,
            },
            'description' => $dispute->description,
            'status' => $dispute->status,
            'resolution' => $dispute->resolution,
            'created_at' => $dispute->created_at->toIso8601String(),
            'resolved_at' => $dispute->resolved_at?->toIso8601String(),
            'raised_by' => $dispute->relationLoaded('raisedBy') ? $dispute->raisedBy : null,
            'resolved_by' => $dispute->relationLoaded('resolvedBy') ? $dispute->resolvedBy : null,
            'order' => $dispute->relationLoaded('fulfilmentOrder') ? [
                'id' => $dispute->fulfilmentOrder->id,
                'order_number' => $dispute->fulfilmentOrder->order_number,
                'status' => $dispute->fulfilmentOrder->status,
                'total' => $dispute->fulfilmentOrder->total,
                'currency' => $dispute->fulfilmentOrder->currency,
                'created_at' => $dispute->fulfilmentOrder->created_at->toIso8601String(),
                'items' => $dispute->fulfilmentOrder->relationLoaded('items') ? $dispute->fulfilmentOrder->items->map(fn ($i) => [
                    'product_id' => $i->physical_product_id,
                    'title' => $i->physicalProduct?->title,
                    'quantity' => $i->quantity,
                    'images' => $i->physicalProduct?->images,
                ]) : [],
                'buyer' => $dispute->fulfilmentOrder->relationLoaded('buyer') ? $dispute->fulfilmentOrder->buyer : null,
            ] : null,
        ];
    }
}
