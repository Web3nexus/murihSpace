<?php

namespace App\Http\Controllers;

use App\Services\CurrencyConverter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CurrencyController extends Controller
{
    public function __construct(
        private readonly CurrencyConverter $converter,
    ) {}

    public function rates(Request $request): JsonResponse
    {
        $from = strtoupper($request->query('from', 'USD'));
        $amount = (float) $request->query('amount', 1);
        $to = strtoupper($request->query('to', 'NGN'));

        $result = $this->converter->convert($amount, $from, $to, fromCents: false);

        return response()->json(['data' => $result]);
    }

    public function supported(): JsonResponse
    {
        $currencies = [];
        foreach ($this->converter->getSupportedCurrencies() as $code) {
            $currencies[] = [
                'code' => $code,
                'symbol' => $this->converter->getSymbol($code),
                'name' => $this->getCurrencyName($code),
            ];
        }

        return response()->json(['data' => $currencies]);
    }

    public function convert(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'from' => ['required', 'string', 'size:3'],
            'to' => ['required', 'string', 'size:3'],
            'from_cents' => ['boolean'],
        ]);

        $result = $this->converter->convert(
            $validated['amount'],
            $validated['from'],
            $validated['to'],
            fromCents: $validated['from_cents'] ?? true,
        );

        return response()->json(['data' => $result]);
    }

    private function getCurrencyName(string $code): string
    {
        return match ($code) {
            'NGN' => 'Nigerian Naira',
            'USD' => 'US Dollar',
            'GBP' => 'British Pound',
            'EUR' => 'Euro',
            'GHS' => 'Ghanaian Cedi',
            'KES' => 'Kenyan Shilling',
            'ZAR' => 'South African Rand',
            'XOF' => 'West African CFA Franc',
            default => $code,
        };
    }
}
