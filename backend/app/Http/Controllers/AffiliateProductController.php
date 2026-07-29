<?php

namespace App\Http\Controllers;

use App\Models\AffiliateProduct;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class AffiliateProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $products = AffiliateProduct::where('creator_id', $request->user()->id)
            ->latest()->get();

        return response()->json(['data' => $products]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'url' => ['required', 'string', 'max:2000'],
            'commission_rate' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);

        $product = AffiliateProduct::create([
            'creator_id' => $request->user()->id,
            'name' => $validated['name'],
            'url' => $validated['url'],
            'commission_rate' => $validated['commission_rate'] ?? 0,
        ]);

        return response()->json(['data' => $product], 201);
    }

    public function show(Request $request, AffiliateProduct $product): JsonResponse
    {
        if ($product->creator_id !== $request->user()->id) abort(403);
        return response()->json(['data' => $product]);
    }

    public function update(Request $request, AffiliateProduct $product): JsonResponse
    {
        if ($product->creator_id !== $request->user()->id) abort(403);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'url' => ['sometimes', 'string', 'max:2000'],
            'commission_rate' => ['nullable', 'integer', 'min:0', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $product->update($validated);

        return response()->json(['data' => $product->fresh()]);
    }

    public function destroy(Request $request, AffiliateProduct $product): JsonResponse
    {
        if ($product->creator_id !== $request->user()->id) abort(403);
        $product->delete();
        return response()->json(['message' => 'Affiliate product deleted.']);
    }

    public function redirectClick(Request $request, AffiliateProduct $product): RedirectResponse
    {
        if (!$product->is_active) {
            return redirect()->away($product->url);
        }

        $product->increment('clicks');

        return redirect()->away($product->url);
    }
}
