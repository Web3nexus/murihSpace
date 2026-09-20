<?php

namespace App\Http\Controllers;

use App\Models\CoinPack;
use App\Services\NativeStore\Exceptions\StoreVerificationException;
use App\Services\NativeStore\NativeCoinPurchaseService;
use App\Services\NativeStore\NativeStoreService;
use App\Services\PurchaseGate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

/**
 * Native (App Store / Google Play) coin purchases.
 *
 * These endpoints are the money-in path for the native apps and are verified
 * server-to-server with the app stores. They intentionally bypass the online
 * payment providers entirely.
 */
class NativeStoreController extends Controller
{
    public function __construct(private readonly NativeCoinPurchaseService $service)
    {
    }

    public function intent(Request $request, NativeStoreService $stores): JsonResponse
    {
        if (app(PurchaseGate::class)->blocksWebPurchase($request)) {
            return response()->json(['errors' => ['purchase' => ['Web purchases are disabled for this distribution.']]], 403);
        }

        $data = $request->validate([
            'coin_pack_id' => ['required', 'integer', 'exists:coin_packs,id'],
            'store' => ['required', Rule::in(['apple', 'google'])],
        ]);

        $pack = CoinPack::query()->active()->find($data['coin_pack_id']);

        if (! $pack) {
            return response()->json(['errors' => ['coin_pack_id' => ['Coin pack not found.']]], 404);
        }

        $productId = $stores->productIdForPack($pack, $data['store']);

        if (! $stores->isStoreEnabled($data['store'])) {
            return response()->json(['errors' => ['store' => ['Native store billing is not configured for this platform.']]], 503);
        }

        if (! $productId) {
            return response()->json(['errors' => ['store' => ['This coin pack has no store product for the selected platform.']]], 422);
        }

        return response()->json(
            $this->service->intent($request->user(), $data['store'], $pack)
        );
    }

    public function verify(Request $request, NativeStoreService $stores): JsonResponse
    {
        if (app(PurchaseGate::class)->blocksWebPurchase($request)) {
            return response()->json(['errors' => ['purchase' => ['Web purchases are disabled for this distribution.']]], 403);
        }

        $data = $request->validate([
            'coin_pack_id' => ['nullable', 'integer', 'exists:coin_packs,id'],
            'store' => ['required', Rule::in(['apple', 'google'])],
            'product_id' => ['required', 'string', 'max:191'],
            'token' => ['required', 'string', 'max:12000'],
            'transaction_id' => ['nullable', 'string', 'max:191'],
            'order_id' => ['nullable', 'string', 'max:191'],
        ]);

        $pack = $data['coin_pack_id']
            ? CoinPack::query()->active()->find($data['coin_pack_id'])
            : $stores->packForProduct($data['store'], $data['product_id']);

        if (! $pack) {
            return response()->json(['errors' => ['coin_pack_id' => ['Coin pack not found.']]], 404);
        }

        try {
            $result = $this->service->verifyAndCredit(
                user: $request->user(),
                pack: $pack,
                store: $data['store'],
                productId: $data['product_id'],
                token: $data['token'],
                transactionId: $data['transaction_id'] ?? null,
                orderId: $data['order_id'] ?? null,
            );
        } catch (StoreVerificationException $e) {
            Log::warning('Native store purchase rejected', [
                'user_id' => $request->user()->id,
                'store' => $data['store'],
                'product_id' => $data['product_id'],
                'reason' => $e->getMessage(),
            ]);

            return response()->json([
                'errors' => ['purchase' => [$e->getMessage()]],
            ], 422);
        }

        return response()->json(
            $result,
            ($result['already_processed'] ?? true) ? 200 : 201
        );
    }
}