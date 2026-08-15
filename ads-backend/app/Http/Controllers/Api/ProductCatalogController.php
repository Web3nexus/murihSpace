<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductCatalog;
use App\Models\Product;
use App\Models\AdAccountMember;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductCatalogController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        if (!$advertiserId) {
            return response()->json(['message' => 'Missing X-Advertiser-ID header'], 400);
        }

        $catalogs = ProductCatalog::where('advertiser_id', $advertiserId)
            ->withCount('products')
            ->get();

        return response()->json($catalogs);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        if (!$advertiserId) {
            return response()->json(['message' => 'Missing X-Advertiser-ID header'], 400);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'currency' => 'nullable|string|max:3',
        ]);

        $validated['advertiser_id'] = $advertiserId;
        
        if (!isset($validated['currency'])) {
            $validated['currency'] = 'USD';
        }

        $catalog = ProductCatalog::create($validated);

        return response()->json($catalog, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id, Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $catalog = ProductCatalog::where('advertiser_id', $advertiserId)->findOrFail($id);

        return response()->json($catalog);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $catalog = ProductCatalog::where('advertiser_id', $advertiserId)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'currency' => 'sometimes|string|max:3',
        ]);

        $catalog->update($validated);

        return response()->json($catalog);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id, Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $catalog = ProductCatalog::where('advertiser_id', $advertiserId)->findOrFail($id);
        
        $catalog->delete();

        return response()->json(null, 204);
    }

    /**
     * Sync products from the main MurihSpace app for this advertiser.
     */
    public function sync(Request $request, string $id)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        if (!$advertiserId) {
            return response()->json(['message' => 'Missing X-Advertiser-ID header'], 400);
        }

        // Verify catalog ownership
        $catalog = ProductCatalog::where('advertiser_id', $advertiserId)->findOrFail($id);

        // To sync from the core DB, we need the core user ID. 
        // In this implementation, we get the first member of the ad account.
        $member = AdAccountMember::where('ad_account_id', $advertiserId)->first();
        $coreUserId = $member ? $member->murihspace_user_id : 1; // Fallback to 1 for dev if needed

        $syncedCount = 0;

        try {
            // Fetch physical products
            $physicalProducts = DB::connection('core')
                ->table('physical_products')
                ->where('creator_id', $coreUserId)
                ->get();

            foreach ($physicalProducts as $product) {
                // Decode JSON images array if it exists
                $images = is_string($product->images) ? json_decode($product->images, true) : $product->images;
                $imageUrl = !empty($images) && is_array($images) ? $images[0] : null;

                Product::updateOrCreate(
                    [
                        'product_catalog_id' => $catalog->id,
                        'retailer_product_id' => 'phys_' . $product->id,
                    ],
                    [
                        'name' => $product->title,
                        'description' => $product->description,
                        'image_url' => $imageUrl,
                        'price' => $product->price,
                        'currency' => $product->currency ?? $catalog->currency,
                        'in_stock' => $product->stock_quantity > 0 || !$product->track_inventory,
                    ]
                );
                $syncedCount++;
            }

            // Fetch digital products
            $digitalProducts = DB::connection('core')
                ->table('digital_products')
                ->where('creator_id', $coreUserId)
                ->get();

            foreach ($digitalProducts as $product) {
                Product::updateOrCreate(
                    [
                        'product_catalog_id' => $catalog->id,
                        'retailer_product_id' => 'digi_' . $product->id,
                    ],
                    [
                        'name' => $product->title,
                        'description' => $product->description,
                        'image_url' => $product->cover_url,
                        'price' => $product->price, // Digital product prices are decimals, usually stored as decimal/double
                        'currency' => $product->currency ?? $catalog->currency,
                        'in_stock' => true,
                    ]
                );
                $syncedCount++;
            }

            return response()->json([
                'message' => 'Successfully synced ' . $syncedCount . ' products.',
                'synced_count' => $syncedCount
            ]);

        } catch (\Exception $e) {
            \Log::error('Error syncing products: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to sync products. Make sure the core database connection is configured correctly.',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
