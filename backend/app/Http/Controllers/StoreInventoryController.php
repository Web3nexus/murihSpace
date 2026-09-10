<?php

namespace App\Http\Controllers;

use App\Models\PhysicalProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreInventoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $items = PhysicalProduct::where('creator_id', $request->user()->id)
            ->select('id', 'title as product_name', 'sku', 'stock_quantity as quantity', 'low_stock_threshold')
            ->selectRaw('0 as reserved')
            ->latest()->get();

        return response()->json(['data' => $items]);
    }

    public function update(Request $request, PhysicalProduct $product): JsonResponse
    {
        // Ensure the product belongs to the authenticated user
        if ($product->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:0'],
        ]);

        $product->update(['stock_quantity' => $validated['quantity']]);

        return response()->json(['data' => $product->fresh()]);
    }
}
