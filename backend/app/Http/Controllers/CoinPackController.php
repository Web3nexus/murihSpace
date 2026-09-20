<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
use App\Models\CoinPack;
use App\Models\CoinPurchase;
use App\Services\Accounting\AccountingStreamService;
use App\Services\Payment\Contracts\CollectionProviderInterface;
use App\Services\Payment\Exceptions\RoutingException;
use App\Services\Payment\PaymentService;
use App\Services\Payment\Router\ProviderRouter;
use App\Services\Tax\TaxCalculationService;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class CoinPackController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
        private TaxCalculationService $taxService,
        private AccountingStreamService $accounting,
        private ProviderRouter $router,
        private PaymentService $paymentService,
    ) {}

    /**
     * Attempt to run a coin purchase through an external payment provider
     * (e.g. Paddle as Merchant of Record). Returns an async checkout payload or null
     * when no business route / usable provider exists (then the caller uses mock flow).
     */
    private function startExternalCheckout(Request $request, string $businessType, array $data): ?array
    {
        $country = $data['country_code'] ?? $request->user()->country;

        try {
            $provider = $this->router->resolve(
                transactionType: 'payment',
                currency: 'USD',
                country: $country,
                paymentMethod: 'card',
                amount: (int) $data['amount_minor'],
                businessType: $businessType
            );
        } catch (RoutingException $e) {
            return null;
        }

        if (! $provider instanceof CollectionProviderInterface || ! $provider->isAvailable()) {
            return null;
        }

        try {
            return $this->paymentService->initializePayment([
                'amount' => (int) $data['amount_minor'],
                'currency' => 'USD',
                'customer_id' => $request->user()->id,
                'user_id' => $request->user()->id,
                'customer_email' => $request->user()->email,
                'customer_name' => $request->user()->name,
                'country' => $country,
                'payment_method' => 'card',
                'transaction_type' => $businessType,
                'idempotency_key' => $data['reference'],
                'return_url' => $data['return_url'] ?? null,
                'business_type' => $businessType,
                'metadata' => $data['metadata'] ?? [],
            ]);
        } catch (\Exception $e) {
            Log::warning("External checkout init failed for {$businessType}: {$e->getMessage()}", [
                'reference' => $data['reference'],
            ]);

            return null;
        }
    }

    /**
     * Number of MSH coins credited per 1 USD. Editable by admins.
     */
    public static function coinConversionRate(): float
    {
        $rate = (float) AdminSetting::get('coin_conversion_rate', 10);
        return $rate > 0 ? $rate : 10;
    }

    public static function minPurchaseUsd(): float
    {
        return max(0.5, (float) AdminSetting::get('coin_min_purchase_usd', 1));
    }

    public static function maxPurchaseUsd(): float
    {
        return min(100000, (float) AdminSetting::get('coin_max_purchase_usd', 10000));
    }

    public function catalogue(Request $request): JsonResponse
    {
        $targetCurrency = strtoupper($request->query('currency', 'NGN'));
        $rateService = app(\App\Services\Payment\LiveExchangeRateService::class);
        $rate = $rateService->getRate('USD', $targetCurrency);
        $coinRate = self::coinConversionRate();

        $packs = CoinPack::active()->orderBy('sort_order')->get()->map(function ($pack) use ($targetCurrency, $rate, $rateService, $coinRate) {
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

        return response()->json([
            'data' => $packs->values(),
            'coin_conversion_rate' => $coinRate,
            'currency' => 'USD',
            'min_purchase_usd' => self::minPurchaseUsd(),
            'max_purchase_usd' => self::maxPurchaseUsd(),
        ]);
    }

    /**
     * Resolve the statutory VAT/GST for a coin purchase in USD cents using the
     * buyer's requested country (ISO2/ISO3) falling back to their profile country.
     */
    private function purchaseTaxInfo(Request $request, int $amountMinor): array
    {
        $countryCode = $request->input('country_code') ?: $request->user()->country;

        return $this->taxService->resolveCheckoutTax($amountMinor, $countryCode, null, 'commerce');
    }

    /**
     * Journal the coin purchase into the accounting ledger + tax liabilities.
     * Idempotent by coin purchase reference.
     */
    private function recordCoinPurchaseRevenue(CoinPurchase $purchase, array $taxInfo, string $reference): void
    {
        $this->accounting->recordCreditSale(
            referenceKey: 'COIN_'.$reference,
            sourceId: $purchase->id,
            streamType: 'commerce',
            currency: 'USD',
            grossCents: (int) $purchase->amount_paid,
            taxCents: (int) $taxInfo['tax_amount_cents'],
            taxRate: (float) $taxInfo['tax_rate_percentage'],
            taxType: $taxInfo['tax_type'],
            taxName: $taxInfo['tax_name'],
            countryCode: $taxInfo['country_code'],
            metadata: ['coin_pack_id' => $purchase->coin_pack_id, 'purchase_reference' => $reference],
        );
    }

    /**
     * POST /api/v1/coins/purchase-estimate
     * Preview the VAT/GST on a coin purchase before paying.
     */
    public function estimate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'coin_pack_id' => ['nullable', 'integer', 'exists:coin_packs,id'],
            'amount_usd'   => ['nullable', 'numeric', 'min:0.01'],
            'amount_minor' => ['nullable', 'integer', 'min:1'],
            'country_code' => ['nullable', 'string', 'max:3', 'alpha'],
        ]);

        $amountMinor = null;
        if (isset($validated['coin_pack_id'])) {
            $pack = CoinPack::findOrFail($validated['coin_pack_id']);
            $amountMinor = (int) $pack->price;
        } elseif (isset($validated['amount_minor']) && (int) $validated['amount_minor'] > 0) {
            $amountMinor = (int) $validated['amount_minor'];
        } elseif (isset($validated['amount_usd'])) {
            $amountMinor = (int) round(((float) $validated['amount_usd']) * 100);
        }

        if ($amountMinor === null || $amountMinor < 1) {
            return response()->json(['message' => 'A coin pack or purchase amount is required.'], 422);
        }

        $taxInfo = $this->purchaseTaxInfo($request, $amountMinor);
        $taxCents = (int) $taxInfo['tax_amount_cents'];

        return response()->json([
            'data' => [
                'amount_usd'         => $amountMinor / 100.0,
                'amount_minor'       => $amountMinor,
                'tax'                => $taxCents,
                'tax_rate'           => (float) $taxInfo['tax_rate_percentage'],
                'tax_name'           => $taxInfo['tax_name'],
                'tax_type'           => $taxInfo['tax_type'],
                'tax_country_code'   => $taxInfo['country_code'],
                'total_usd'          => ($amountMinor + $taxCents) / 100.0,
                'total_minor'        => $amountMinor + $taxCents,
                'currency'           => 'USD',
            ],
        ]);
    }

    public function purchase(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'coin_pack_id' => ['required', 'integer', 'exists:coin_packs,id'],
            'reference' => ['nullable', 'string', 'max:64'],
            'country_code' => ['nullable', 'string', 'max:3', 'alpha'],
        ]);

        $pack = CoinPack::findOrFail($validated['coin_pack_id']);

        if (! $pack->is_active) {
            return response()->json(['message' => 'This coin pack is not currently available.'], 422);
        }

        $user = $request->user();
        $reference = $validated['reference'] ?? 'CP-'.Str::upper(Str::random(16));
        $totalCoins = $pack->coins + $pack->bonus_coins;

        $taxInfo = $this->purchaseTaxInfo($request, (int) $pack->price);
        $taxCents = (int) $taxInfo['tax_amount_cents'];
        $totalCharged = (int) $pack->price + $taxCents;

        // External provider flow (Paddle MoR handles tax itself, so we charge pre-tax gross).
        $async = $this->startExternalCheckout($request, 'coin_pack', [
            'amount_minor' => (int) $pack->price,
            'country_code' => $request->input('country_code'),
            'reference' => $reference,
            'return_url' => $request->input('return_url'),
            'metadata' => [
                'coin_pack_id' => $pack->id,
                'coin_pack_type' => 'pack',
                'amount_usd_minor' => (int) $pack->price,
                'tax' => 0,
                'total_charged' => (int) $pack->price,
                'tax_rate' => 0.0,
                'tax_type' => 'provider_handled',
                'coin_conversion_rate' => self::coinConversionRate(),
            ],
        ]);

        if ($async !== null) {
            return response()->json($async, 202);
        }

        $purchase = \Illuminate\Support\Facades\DB::transaction(function () use ($user, $pack, $reference, $totalCoins, $taxInfo, $taxCents, $totalCharged) {
            $this->ledgerService->credit(
                user: $user->id,
                amount: $totalCoins,
                currency: $pack->currency,
                walletType: 'system',
                balanceCategory: 'available',
                type: 'coin_purchase',
                description: "Purchased {$pack->name} ({$totalCoins} coins)",
                idempotencyKey: $reference,
                metadata: ['coin_pack_id' => $pack->id, 'reference' => $reference],
            );

            return CoinPurchase::create([
                'user_id' => $user->id,
                'coin_pack_id' => $pack->id,
                'coins' => $pack->coins,
                'bonus_coins' => $pack->bonus_coins,
                'amount_paid' => $pack->price,
                'tax' => $taxCents,
                'total_charged' => $totalCharged,
                'tax_rate' => $taxInfo['tax_rate_percentage'],
                'tax_country_code' => $taxInfo['country_code'],
                'tax_type' => $taxInfo['tax_type'],
                'tax_name' => $taxInfo['tax_name'],
                'currency' => $pack->currency,
                'status' => 'completed',
                'provider' => 'mock',
                'reference' => $reference,
            ]);
        });

        $purchase->refresh();
        $this->recordCoinPurchaseRevenue($purchase, $taxInfo, $reference);

        return response()->json([
            'message' => 'Coins added to your wallet.',
            'data' => [
                'purchase' => $purchase,
                'coins_added' => $totalCoins,
                'tax' => $taxCents,
                'tax_rate' => (float) $taxInfo['tax_rate_percentage'],
                'total_charged' => $totalCharged,
            ],
        ], 201);
    }

    public function purchaseCustom(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount_usd' => ['nullable', 'numeric', 'min:0.01'],
            'amount_minor' => ['nullable', 'integer', 'min:1'],
            'reference' => ['nullable', 'string', 'max:64'],
            'country_code' => ['nullable', 'string', 'max:3', 'alpha'],
        ]);

        $amountMinor = isset($validated['amount_minor']) && $validated['amount_minor'] > 0
            ? (int) $validated['amount_minor']
            : (int) round(((float) $validated['amount_usd']) * 100);

        $usd = $amountMinor / 100.0;
        $minUsd = self::minPurchaseUsd();
        $maxUsd = self::maxPurchaseUsd();

        if ($usd < $minUsd || $usd > $maxUsd) {
            return response()->json([
                'message' => "Amount must be between \${$minUsd} and \${$maxUsd} USD.",
            ], 422);
        }

        $coinRate = self::coinConversionRate();
        $totalCoins = (int) round(($amountMinor / 100.0) * $coinRate);

        if ($totalCoins < 1) {
            return response()->json(['message' => 'Amount is too small to purchase coins.'], 422);
        }

        $user = $request->user();
        $reference = $validated['reference'] ?? 'CC-'.Str::upper(Str::random(16));

        $taxInfo = $this->purchaseTaxInfo($request, $amountMinor);
        $taxCents = (int) $taxInfo['tax_amount_cents'];
        $totalCharged = $amountMinor + $taxCents;

        // External provider flow (Paddle MoR handles tax itself, so we charge pre-tax gross).
        $async = $this->startExternalCheckout($request, 'coin_pack', [
            'amount_minor' => $amountMinor,
            'country_code' => $request->input('country_code'),
            'reference' => $reference,
            'return_url' => $request->input('return_url'),
            'metadata' => [
                'coin_custom' => true,
                'amount_usd_minor' => $amountMinor,
                'tax' => 0,
                'total_charged' => $amountMinor,
                'tax_rate' => 0.0,
                'tax_type' => 'provider_handled',
                'coin_conversion_rate' => $coinRate,
            ],
        ]);

        if ($async !== null) {
            return response()->json($async, 202);
        }

        $purchase = \Illuminate\Support\Facades\DB::transaction(function () use ($user, $reference, $totalCoins, $amountMinor, $taxInfo, $taxCents, $totalCharged) {
            $this->ledgerService->credit(
                user: $user->id,
                amount: $totalCoins,
                currency: 'USD',
                walletType: 'system',
                balanceCategory: 'available',
                type: 'coin_purchase',
                description: "Purchased {$totalCoins} coins (custom amount)",
                idempotencyKey: $reference,
                metadata: ['reference' => $reference, 'coin_conversion_rate' => self::coinConversionRate()],
            );

            return CoinPurchase::create([
                'user_id' => $user->id,
                'coin_pack_id' => null,
                'coins' => $totalCoins,
                'bonus_coins' => 0,
                'amount_paid' => $amountMinor,
                'tax' => $taxCents,
                'total_charged' => $totalCharged,
                'tax_rate' => $taxInfo['tax_rate_percentage'],
                'tax_country_code' => $taxInfo['country_code'],
                'tax_type' => $taxInfo['tax_type'],
                'tax_name' => $taxInfo['tax_name'],
                'currency' => 'USD',
                'status' => 'completed',
                'provider' => 'mock',
                'reference' => $reference,
            ]);
        });

        $purchase->refresh();
        $this->recordCoinPurchaseRevenue($purchase, $taxInfo, $reference);

        return response()->json([
            'message' => 'Coins added to your wallet.',
            'data' => [
                'purchase' => $purchase,
                'coins_added' => $totalCoins,
                'tax' => $taxCents,
                'tax_rate' => (float) $taxInfo['tax_rate_percentage'],
                'total_charged' => $totalCharged,
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
        return response()->json([
            'data' => CoinPack::orderBy('sort_order')->get(),
            'coin_conversion_rate' => self::coinConversionRate(),
            'min_purchase_usd' => self::minPurchaseUsd(),
            'max_purchase_usd' => self::maxPurchaseUsd(),
        ]);
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

    public function adminRate(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'coin_conversion_rate' => self::coinConversionRate(),
                'label' => '1 USD = ' . self::coinsPerDollarRepresentation() . ' MSH',
                'min_purchase_usd' => self::minPurchaseUsd(),
                'max_purchase_usd' => self::maxPurchaseUsd(),
            ],
        ]);
    }

    public function adminUpdateRate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'coin_conversion_rate' => ['sometimes', 'numeric', 'min:0.01', 'max:1000000'],
            'coin_min_purchase_usd' => ['sometimes', 'numeric', 'min:0.5', 'max:100000'],
            'coin_max_purchase_usd' => ['sometimes', 'numeric', 'min:1', 'max:1000000'],
        ]);

        if (isset($validated['coin_conversion_rate'])) {
            AdminSetting::set('coin_conversion_rate', (string) $validated['coin_conversion_rate']);
        }

        if (isset($validated['coin_min_purchase_usd'])) {
            AdminSetting::set('coin_min_purchase_usd', (string) $validated['coin_min_purchase_usd']);
        }

        if (isset($validated['coin_max_purchase_usd'])) {
            AdminSetting::set('coin_max_purchase_usd', (string) $validated['coin_max_purchase_usd']);
        }

        return response()->json([
            'message' => 'Conversion rate updated.',
            'data' => [
                'coin_conversion_rate' => self::coinConversionRate(),
                'label' => '1 USD = ' . self::coinsPerDollarRepresentation() . ' MSH',
                'min_purchase_usd' => self::minPurchaseUsd(),
                'max_purchase_usd' => self::maxPurchaseUsd(),
            ],
        ]);
    }

    private static function coinsPerDollarRepresentation(): string
    {
        $rate = self::coinConversionRate();
        return (int) $rate == $rate ? (string) (int) $rate : (string) $rate;
    }
}
