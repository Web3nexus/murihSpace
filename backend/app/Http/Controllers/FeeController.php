<?php

namespace App\Http\Controllers;

use App\Services\Wallet\FeeCalculatorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeeController extends Controller
{
    public function __construct(
        private readonly FeeCalculatorService $feeCalculator,
    ) {}

    /**
     * POST /api/v1/fees/preview
     * Pre-flight fee preview calculation before user confirms transaction.
     */
    public function preview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'transaction_code' => ['required', 'string', 'max:50'],
            'amount'           => ['required', 'integer', 'min:1'], // in minor units
            'currency'         => ['nullable', 'string', 'max:3'],
            'payment_method'   => ['nullable', 'string', 'max:50'],
            'wallet_type'      => ['nullable', 'string', 'max:20'],
        ]);

        $code     = strtoupper($validated['transaction_code']);
        $amount   = (int) $validated['amount'];
        $currency = strtoupper($validated['currency'] ?? 'NGN');
        $method   = $validated['payment_method'] ?? null;
        $wType    = $validated['wallet_type'] ?? null;
        $role     = $request->user()?->role;

        $preview = $this->feeCalculator->calculate($code, $amount, $currency, $method, $role, $wType);

        return response()->json([
            'data' => $preview,
        ]);
    }
}
