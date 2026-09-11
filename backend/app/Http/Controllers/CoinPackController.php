<?php

namespace App\Http\Controllers;

use App\Models\CoinPack;
use App\Models\CoinPurchase;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CoinPackController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
    ) {}

    public function catalogue(Request $request): JsonResponse
    {
        $targetCurrency = strtoupper($request->query('currency', 'NGN'));
        $rateService = app(\App\Services\Payment\LiveExchangeRateService::class);
        $rate = $rateService->getRate('USD', $targetCurrency);

        $packs = CoinPack::active()->orderBy('sort_order')->get()->map(function ($pack) use ($targetCurrency, $rate, $rateService) {
            $priceUsd = $pack->price / 100.0;
            $localPrice = round($priceUsd * $rate, 2);

            return [
                'id' => $pack->id,
                'name' => $pack->name,
                'coins' => $pack->coins,
                'bonus_coins' => $pack->bonus_coins,
                'total_coins' => $pack->coins + $pack->bonus_coins,
                'price' => $pack->price, // in USD cents
                'currency' => 'USD',
                'price_usd' => $priceUsd,
                'formatted_usd' => '$' . number_format($priceUsd, 2),
                'local_currency' => $targetCurrency,
                'local_price' => $localPrice,
                'local_formatted' => $rateService->format($localPrice, $targetCurrency),
                'badge' => $pack->badge,
                'is_active' => $pack->is_active,
                'sort_order' => $pack->sort_order,
            ];
        });

        return response()->json($packs);
    }

    public function purchase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'coin_pack_id' => ['required', 'integer', 'exists:coin_packs,id'],
            'reference' => ['nullable', 'string', 'max:64'],
        ]);

        $pack = CoinPack::findOrFail($validated['coin_pack_id']);

        if (! $pack->is_active) {
            return response()->json(['message' => 'This coin pack is not currently available.'], 422);
        }

        $user = $request->user();
        $reference = $validated['reference'] ?? 'CP-'.Str::upper(Str::random(16));
        $totalCoins = $pack->coins + $pack->bonus_coins;

        $purchase = \Illuminate\Support\Facades\DB::transaction(function () use ($user, $pack, $reference, $totalCoins) {
            $this->ledgerService->credit(
                $user->id,
                $totalCoins,
                $pack->currency,
                'coin_purchase',
                "Purchased {$pack->name} ({$totalCoins} coins)",
                ['coin_pack_id' => $pack->id, 'reference' => $reference],
            );

            return CoinPurchase::create([
                'user_id' => $user->id,
                'coin_pack_id' => $pack->id,
                'coins' => $pack->coins,
                'bonus_coins' => $pack->bonus_coins,
                'amount_paid' => $pack->price,
                'currency' => $pack->currency,
                'status' => 'completed',
                'provider' => 'mock',
                'reference' => $reference,
            ]);
        });

        return response()->json([
            'message' => 'Coins added to your wallet.',
            'data' => [
                'purchase' => $purchase,
                'coins_added' => $totalCoins,
            ],
        ], 201);
    }

    public function purchases(Request $request): JsonResponse
    {
        $purchases = CoinPurchase::with('coinPack')
            ->where('user_id', $request->user()->id)
            ->latest()
            ->paginate(20);

        return response()->json($purchases);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        return response()->json(CoinPack::orderBy('sort_order')->get());
    }

    public function adminStore(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'coins' => ['required', 'integer', 'min:1'],
            'bonus_coins' => ['nullable', 'integer', 'min:0'],
            'price' => ['required', 'integer', 'min:1'],
            'currency' => ['nullable', 'string', 'max:3'],
            'badge' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $pack = CoinPack::create($validated);
        return response()->json(['message' => 'Coin pack created.', 'data' => $pack], 201);
    }

    public function adminUpdate(Request $request, int $id): JsonResponse
    {
        $pack = CoinPack::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'coins' => ['sometimes', 'integer', 'min:1'],
            'bonus_coins' => ['nullable', 'integer', 'min:0'],
            'price' => ['sometimes', 'integer', 'min:1'],
            'currency' => ['nullable', 'string', 'max:3'],
            'badge' => ['nullable', 'string', 'max:100'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $pack->update($validated);
        return response()->json(['message' => 'Coin pack updated.', 'data' => $pack]);
    }

    public function adminDelete(Request $request, int $id): JsonResponse
    {
        CoinPack::findOrFail($id)->delete();
        return response()->json(['message' => 'Coin pack removed.']);
    }

    public function adminReorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order' => ['required', 'array'],
            'order.*.id' => ['required', 'exists:coin_packs,id'],
            'order.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        foreach ($validated['order'] as $item) {
            CoinPack::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        return response()->json(['message' => 'Coin pack order updated.']);
    }
}
