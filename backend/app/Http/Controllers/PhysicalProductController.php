<?php

namespace App\Http\Controllers;

use App\Models\PhysicalProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PhysicalProductController extends Controller
{
    public function indexPublic(): JsonResponse
    {
        $products = PhysicalProduct::with('creator:id,name,username')
            ->active()
            ->latest()
            ->get()
            ->makeHidden(['stock_quantity', 'low_stock_threshold']);

        return response()->json(['data' => $products]);
    }

    public function myProducts(Request $request): JsonResponse
    {
        $products = PhysicalProduct::where('creator_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $products]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isCreatorOrAdmin()) {
            abort(403);
        }

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'sku' => ['required', 'string', 'max:100', 'unique:physical_products,sku'],
            'price' => ['required', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'category' => ['nullable', Rule::in(PhysicalProduct::CATEGORIES)],
            'images' => ['nullable', 'array', 'max:10'],
            'images.*' => ['required', 'string', 'url', 'max:2000'],
            'stock_quantity' => ['nullable', 'integer', 'min:0'],
            'low_stock_threshold' => ['nullable', 'integer', 'min:0'],
            'track_inventory' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'weight_unit' => ['nullable', 'in:kg,g,lb,oz'],
            'weight' => ['nullable', 'numeric', 'min:0'],
            'length' => ['nullable', 'numeric', 'min:0'],
            'width' => ['nullable', 'numeric', 'min:0'],
            'height' => ['nullable', 'numeric', 'min:0'],
            'origin_country' => ['nullable', 'string', 'size:2'],
        ]);

        $validated['creator_id'] = $request->user()->id;
        $validated['currency'] ??= 'NGN';

        $product = PhysicalProduct::create($validated);

        return response()->json(['data' => $product], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $product = PhysicalProduct::with('creator:id,name,username')
            ->findOrFail($id);

        if ($product->creator_id !== $request->user()->id) {
            $product->makeHidden(['stock_quantity', 'low_stock_threshold']);
        }

        return response()->json(['data' => $product]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $product = PhysicalProduct::findOrFail($id);

        if ($product->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'sku' => ['sometimes', 'string', 'max:100', Rule::unique('physical_products', 'sku')->ignore($product->id)],
            'price' => ['sometimes', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'category' => ['nullable', Rule::in(PhysicalProduct::CATEGORIES)],
            'images' => ['nullable', 'array', 'max:10'],
            'images.*' => ['required', 'string', 'url', 'max:2000'],
            'stock_quantity' => ['nullable', 'integer', 'min:0'],
            'low_stock_threshold' => ['nullable', 'integer', 'min:0'],
            'track_inventory' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
            'weight_unit' => ['nullable', 'in:kg,g,lb,oz'],
            'weight' => ['nullable', 'numeric', 'min:0'],
            'length' => ['nullable', 'numeric', 'min:0'],
            'width' => ['nullable', 'numeric', 'min:0'],
            'height' => ['nullable', 'numeric', 'min:0'],
            'origin_country' => ['nullable', 'string', 'size:2'],
        ]);

        $product->update($validated);

        return response()->json(['data' => $product->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $product = PhysicalProduct::findOrFail($id);

        if ($product->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $product->delete();

        return response()->json(['message' => 'Product deleted.']);
    }

    public function adjustStock(Request $request, int $id): JsonResponse
    {
        $product = PhysicalProduct::findOrFail($id);

        if ($product->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'quantity' => ['required', 'integer'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $newQuantity = $product->stock_quantity + $validated['quantity'];

        if ($newQuantity < 0) {
            return response()->json(['message' => 'Insufficient stock to remove that many units.'], 400);
        }

        $product->update(['stock_quantity' => $newQuantity]);

        return response()->json([
            'message' => "Stock adjusted by {$validated['quantity']}. New quantity: {$newQuantity}." . ($validated['reason'] ?? ''),
            'data' => $product->fresh(),
        ]);
    }
}
