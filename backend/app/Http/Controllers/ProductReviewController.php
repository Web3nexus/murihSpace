<?php

namespace App\Http\Controllers;

use App\Models\PhysicalProduct;
use App\Models\ProductReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductReviewController extends Controller
{
    private const EDIT_HOURS = 24;

    public function index(Request $request, int $productId): JsonResponse
    {
        $product = PhysicalProduct::findOrFail($productId);

        $reviews = ProductReview::where('physical_product_id', $product->id)
            ->approved()
            ->with('buyer:id,name,username')
            ->latest()
            ->get()
            ->map(fn ($r) => $this->format($r));

        $stats = [
            'average' => round($reviews->avg('rating') ?? 0, 1),
            'total' => $reviews->count(),
            'distribution' => collect(range(5, 1))->mapWithKeys(fn ($s) => [
                $s => $reviews->where('rating', $s)->count(),
            ]),
        ];

        return response()->json(['data' => $reviews, 'stats' => $stats]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'physical_product_id' => ['required', 'integer', 'exists:physical_products,id'],
            'fulfilment_order_id' => ['nullable', 'integer', 'exists:fulfilment_orders,id'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:5000'],
        ]);

        $buyerId = $request->user()->id;

        $product = PhysicalProduct::findOrFail($validated['physical_product_id']);
        if ($product->creator_id === $buyerId) {
            return response()->json(['message' => 'You cannot review your own product.'], 403);
        }

        $existing = ProductReview::where('physical_product_id', $validated['physical_product_id'])
            ->where('buyer_id', $buyerId)
            ->first();

        if ($existing) {
            return response()->json(['message' => 'You have already reviewed this product.'], 409);
        }

        if (isset($validated['fulfilment_order_id'])) {
            $owned = \App\Models\FulfilmentOrder::where('id', $validated['fulfilment_order_id'])
                ->where('buyer_id', $buyerId)
                ->whereHas('items', fn ($q) => $q->where('physical_product_id', $validated['physical_product_id']))
                ->exists();

            if (! $owned) {
                return response()->json(['message' => 'Order does not contain this product.'], 403);
            }
        }

        $review = ProductReview::create([
            ...$validated,
            'buyer_id' => $buyerId,
            'is_approved' => false,
        ]);

        $review->load('buyer:id,name,username');

        return response()->json(['data' => $this->format($review)], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $review = ProductReview::where('buyer_id', $request->user()->id)->findOrFail($id);

        $editCutoff = $review->created_at->addHours(self::EDIT_HOURS);
        if (now()->greaterThan($editCutoff)) {
            return response()->json([
                'message' => 'The edit window has expired. Reviews can only be edited within ' . self::EDIT_HOURS . ' hours of submission.',
            ], 403);
        }

        $validated = $request->validate([
            'rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:5000'],
        ]);

        $review->update($validated);

        return response()->json(['data' => $this->format($review)]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $review = ProductReview::where('buyer_id', $request->user()->id)->findOrFail($id);
        $review->delete();

        return response()->json(['message' => 'Review deleted.']);
    }

    public function myReviews(Request $request): JsonResponse
    {
        $reviews = ProductReview::where('buyer_id', $request->user()->id)
            ->with('physicalProduct:id,title,images')
            ->latest()
            ->get()
            ->map(fn ($r) => $this->format($r));

        return response()->json(['data' => $reviews]);
    }

    // ── Admin: list, edit, approve, delete (no time restriction) ──────────

    public function adminIndex(Request $request): JsonResponse
    {
        $reviews = ProductReview::with(['buyer:id,name,username', 'physicalProduct:id,title,images'])
            ->latest()
            ->get()
            ->map(fn ($r) => $this->format($r));

        return response()->json(['data' => $reviews]);
    }

    public function adminUpdate(Request $request, int $id): JsonResponse
    {
        $review = ProductReview::findOrFail($id);

        $validated = $request->validate([
            'rating' => ['sometimes', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:5000'],
            'is_approved' => ['sometimes', 'boolean'],
        ]);

        $review->update($validated);

        return response()->json(['data' => $this->format($review)]);
    }

    public function adminApprove(Request $request, int $id): JsonResponse
    {
        $review = ProductReview::findOrFail($id);
        $review->update(['is_approved' => !$review->is_approved]);

        return response()->json(['data' => $this->format($review)]);
    }

    public function adminDestroy(Request $request, int $id): JsonResponse
    {
        $review = ProductReview::findOrFail($id);
        $review->delete();

        return response()->json(['message' => 'Review deleted.']);
    }

    private function format(ProductReview $review): array
    {
        $canEdit = $review->created_at && $review->created_at->addHours(self::EDIT_HOURS)->isFuture();
        $editExpiresAt = $review->created_at ? $review->created_at->addHours(self::EDIT_HOURS)->toIso8601String() : null;

        return [
            'id' => $review->id,
            'physical_product_id' => $review->physical_product_id,
            'rating' => $review->rating,
            'title' => $review->title,
            'body' => $review->body,
            'is_approved' => $review->is_approved,
            'created_at' => $review->created_at->toIso8601String(),
            'can_edit' => $canEdit,
            'edit_expires_at' => $editExpiresAt,
            'buyer' => $review->relationLoaded('buyer') ? $review->buyer : null,
            'product' => $review->relationLoaded('physicalProduct') ? [
                'id' => $review->physicalProduct->id,
                'title' => $review->physicalProduct->title,
                'images' => $review->physicalProduct->images,
            ] : null,
        ];
    }
}
