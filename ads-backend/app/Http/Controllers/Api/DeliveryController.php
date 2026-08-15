<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Services\Delivery\AuctionService;

class DeliveryController extends Controller
{
    protected AuctionService $auctionService;

    public function __construct(AuctionService $auctionService)
    {
        $this->auctionService = $auctionService;
    }

    /**
     * Request an ad for a specific placement.
     * GET /api/delivery/ad?placement=feed&user_id=123
     */
    public function getAd(Request $request)
    {
        if (!$request->hasValidSignature()) {
            return response()->json([
                'status' => 'unauthorized',
                'message' => 'Invalid signature.',
                'data' => null
            ], 403);
        }

        $request->validate([
            'placement' => 'required|string|in:feed,story,discover,store',
            'user_id' => 'required|integer' // The viewer's MurihSpace user ID
        ]);

        $placement = $request->query('placement');
        $userId = $request->query('user_id');

        $winningAd = $this->auctionService->runAuction($userId, $placement);

        if (!$winningAd) {
            return response()->json([
                'status' => 'no_fill',
                'message' => 'No eligible ads found for this placement.',
                'data' => null
            ], 200);
        }

        // Prepare the delivery payload
        // In a real system, we'd sign impression and click tracking URLs here.
        $payload = [
            'ad_id' => $winningAd->id,
            'campaign_id' => $winningAd->adGroup->campaign_id,
            'creative' => $winningAd->creative->assets ?? null,
            'cta_type' => $winningAd->cta_type,
            'cta_url' => $winningAd->cta_url,
            'promoted_object' => $winningAd->promoted_object_type,
            'tracking' => [
                'impression_url' => url("/api/tracking/impression?ad_id={$winningAd->id}&user_id={$userId}"),
                'click_url' => url("/api/tracking/click?ad_id={$winningAd->id}&user_id={$userId}"),
            ]
        ];

        // DPA (Dynamic Product Ads) logic
        if ($winningAd->creative && $winningAd->creative->type === 'dynamic_product') {
            $pixels = \App\Models\Pixel::where('advertiser_id', $winningAd->adGroup->campaign->advertiser_id)->pluck('pixel_uuid');
            $recentProducts = \App\Models\PixelEvent::whereIn('pixel_uuid', $pixels)
                ->where('user_identifier', (string) $userId)
                ->where('event_type', 'ViewContent')
                ->latest()
                ->take(5)
                ->get()
                ->map(function($event) {
                    return $event->event_data['product_id'] ?? null;
                })
                ->filter()
                ->unique();

            if ($recentProducts->isNotEmpty()) {
                $catalogs = \App\Models\ProductCatalog::where('advertiser_id', $winningAd->adGroup->campaign->advertiser_id)->pluck('id');
                $products = \App\Models\Product::whereIn('product_catalog_id', $catalogs)
                    ->whereIn('retailer_product_id', $recentProducts)
                    ->get();
                $payload['dynamic_products'] = $products;
            }
        }

        return response()->json([
            'status' => 'success',
            'data' => $payload
        ]);
    }
}
