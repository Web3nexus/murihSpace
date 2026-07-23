<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Purchase;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $purchases = Purchase::where('user_id', $request->user()->id)
            ->with(['product:id,title,slug,cover_url,category,file_original_name,file_mime_type,file_size_bytes', 'order:id,order_number,status,currency'])
            ->latest()
            ->paginate(20);

        return response()->json($purchases);
    }

    public function download(Request $request, int $id): JsonResponse
    {
        $purchase = Purchase::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $purchase->increment('download_count');
        $purchase->update(['last_downloaded_at' => now()]);

        return response()->json([
            'data' => [
                'download_url' => url("/api/v1/products/{$purchase->product_id}/download"),
                'expires_at'   => now()->addHours(2)->toIso8601String(),
            ],
        ]);
    }
}
