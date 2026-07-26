<?php

namespace App\Http\Controllers;

use App\Models\Cart;
use App\Models\CartItem;
use App\Models\PhysicalProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CartController extends Controller
{
    private function getOrCreateCart(int $userId): Cart
    {
        return Cart::firstOrCreate(['user_id' => $userId]);
    }

    public function show(Request $request): JsonResponse
    {
        $cart = $this->getOrCreateCart($request->user()->id);
        $cart->load('items.physicalProduct.creator:id,name,username');

        return response()->json([
            'data' => [
                'id' => $cart->id,
                'items' => $cart->items->map(fn ($item) => [
                    'id' => $item->id,
                    'physical_product_id' => $item->physical_product_id,
                    'quantity' => $item->quantity,
                    'product' => $item->physicalProduct ? [
                        'id' => $item->physicalProduct->id,
                        'title' => $item->physicalProduct->title,
                        'price' => $item->physicalProduct->price,
                        'currency' => $item->physicalProduct->currency,
                        'images' => $item->physicalProduct->images,
                        'sku' => $item->physicalProduct->sku,
                        'stock_quantity' => $item->physicalProduct->stock_quantity,
                        'track_inventory' => $item->physicalProduct->track_inventory,
                        'creator' => $item->physicalProduct->creator,
                        'weight' => $item->physicalProduct->weight,
                        'weight_unit' => $item->physicalProduct->weight_unit,
                    ] : null,
                    'line_total' => $item->physicalProduct ? $item->physicalProduct->price * $item->quantity : 0,
                ]),
                'total' => $cart->total(),
                'item_count' => $cart->itemCount(),
            ],
        ]);
    }

    public function addItem(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'physical_product_id' => ['required', 'integer', 'exists:physical_products,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        $product = PhysicalProduct::findOrFail($validated['physical_product_id']);

        if (! $product->is_active) {
            return response()->json(['message' => 'This product is no longer available.'], 400);
        }

        if ($product->track_inventory && $product->stock_quantity < $validated['quantity']) {
            return response()->json([
                'message' => "Insufficient stock. Only {$product->stock_quantity} available.",
                'available' => $product->stock_quantity,
            ], 409);
        }

        $cart = $this->getOrCreateCart($request->user()->id);

        $existing = CartItem::where('cart_id', $cart->id)
            ->where('physical_product_id', $product->id)
            ->first();

        if ($existing) {
            $newQty = $existing->quantity + $validated['quantity'];
            if ($product->track_inventory && $newQty > $product->stock_quantity) {
                return response()->json(['message' => "Cannot add more. Only {$product->stock_quantity} available."], 409);
            }
            $existing->update(['quantity' => $newQty]);
        } else {
            CartItem::create([
                'cart_id' => $cart->id,
                'physical_product_id' => $product->id,
                'quantity' => $validated['quantity'],
            ]);
        }

        return response()->json(['message' => 'Item added to cart.'], 201);
    }

    public function updateItem(Request $request, int $itemId): JsonResponse
    {
        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:100'],
        ]);

        $item = CartItem::whereHas('cart', fn ($q) => $q->where('user_id', $request->user()->id))
            ->findOrFail($itemId);

        if ($item->physicalProduct->track_inventory && $validated['quantity'] > $item->physicalProduct->stock_quantity) {
            return response()->json([
                'message' => "Only {$item->physicalProduct->stock_quantity} available.",
                'available' => $item->physicalProduct->stock_quantity,
            ], 409);
        }

        $item->update(['quantity' => $validated['quantity']]);

        return response()->json(['message' => 'Cart updated.']);
    }

    public function removeItem(Request $request, int $itemId): JsonResponse
    {
        $item = CartItem::whereHas('cart', fn ($q) => $q->where('user_id', $request->user()->id))
            ->findOrFail($itemId);

        $item->delete();

        return response()->json(['message' => 'Item removed from cart.']);
    }

    public function clear(Request $request): JsonResponse
    {
        $cart = Cart::where('user_id', $request->user()->id)->first();
        if ($cart) {
            $cart->items()->delete();
        }

        return response()->json(['message' => 'Cart cleared.']);
    }
}
