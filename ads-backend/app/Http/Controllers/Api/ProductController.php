<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductCatalog;
use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request, string $catalogId)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        if (!$advertiserId) {
            return response()->json(['message' => 'Missing X-Advertiser-ID header'], 400);
        }

        $catalog = ProductCatalog::where('advertiser_id', $advertiserId)->findOrFail($catalogId);

        $products = Product::where('product_catalog_id', $catalog->id)->get();

        return response()->json($products);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request, string $catalogId)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        if (!$advertiserId) {
            return response()->json(['message' => 'Missing X-Advertiser-ID header'], 400);
        }

        $catalog = ProductCatalog::where('advertiser_id', $advertiserId)->findOrFail($catalogId);

        $validated = $request->validate([
            'retailer_product_id' => 'required|string|max:255',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'image_url' => 'nullable|url',
            'product_url' => 'nullable|url',
            'price' => 'nullable|integer',
            'currency' => 'nullable|string|max:3',
            'in_stock' => 'nullable|boolean',
        ]);

        $validated['product_catalog_id'] = $catalog->id;

        $product = Product::create($validated);

        return response()->json($product, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $catalogId, string $id, Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $catalog = ProductCatalog::where('advertiser_id', $advertiserId)->findOrFail($catalogId);
        
        $product = Product::where('product_catalog_id', $catalog->id)->findOrFail($id);

        return response()->json($product);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $catalogId, string $id)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $catalog = ProductCatalog::where('advertiser_id', $advertiserId)->findOrFail($catalogId);
        
        $product = Product::where('product_catalog_id', $catalog->id)->findOrFail($id);

        $validated = $request->validate([
            'retailer_product_id' => 'sometimes|string|max:255',
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'image_url' => 'nullable|url',
            'product_url' => 'nullable|url',
            'price' => 'nullable|integer',
            'currency' => 'nullable|string|max:3',
            'in_stock' => 'nullable|boolean',
        ]);

        $product->update($validated);

        return response()->json($product);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $catalogId, string $id, Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $catalog = ProductCatalog::where('advertiser_id', $advertiserId)->findOrFail($catalogId);
        
        $product = Product::where('product_catalog_id', $catalog->id)->findOrFail($id);
        
        $product->delete();

        return response()->json(null, 204);
    }
}
