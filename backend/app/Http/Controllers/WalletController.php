<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class WalletController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $wallet = $this->ledgerService->getOrCreateWallet($request->user()->id);

        return response()->json([
            'data' => [
                'id' => $wallet->id,
                'balance' => $wallet->balance,
                'currency' => $wallet->currency,
                'formatted' => $this->formatAmount($wallet->balance, $wallet->currency),
                'has_pin' => $wallet->hasPin(),
                'status' => $wallet->status,
            ],
        ]);
    }

    public function setupPin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pin' => ['required', 'string', 'digits:4'],
        ]);

        $wallet = $this->ledgerService->getOrCreateWallet($request->user()->id);

        if ($wallet->hasPin()) {
            return response()->json(['message' => 'PIN already set.', 'code' => 'PIN_ALREADY_SET'], 409);
        }

        $wallet->update([
            'pin_hash' => Hash::make($validated['pin']),
            'pin_set_at' => now(),
        ]);

        return response()->json(['message' => 'Transaction PIN set successfully.', 'data' => ['has_pin' => true]]);
    }

    public function updatePin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_pin' => ['required', 'string', 'digits:4'],
            'new_pin' => ['required', 'string', 'digits:4'],
        ]);

        $wallet = $this->ledgerService->getOrCreateWallet($request->user()->id);

        if (! $wallet->verifyPin($validated['current_pin'])) {
            return response()->json(['message' => 'Current PIN is incorrect.', 'code' => 'INVALID_TRANSACTION_PIN'], 403);
        }

        $wallet->update([
            'pin_hash' => Hash::make($validated['new_pin']),
            'pin_set_at' => now(),
        ]);

        return response()->json(['message' => 'Transaction PIN updated successfully.', 'data' => ['has_pin' => true]]);
    }

    public function verifyPin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pin' => ['required', 'string', 'digits:4'],
        ]);

        $wallet = $this->ledgerService->getOrCreateWallet($request->user()->id);

        if (! $wallet->verifyPin($validated['pin'])) {
            return response()->json(['message' => 'PIN is incorrect.', 'code' => 'INVALID_TRANSACTION_PIN'], 403);
        }

        return response()->json(['message' => 'PIN verified successfully.']);
    }

    public function transactions(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['nullable', 'string'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = LedgerEntry::where('user_id', $request->user()->id)
            ->with('transaction')
            ->latest();

        if (! empty($validated['type'])) {
            $types = match ($validated['type']) {
                'transfer' => ['transfer_in', 'transfer_out'],
                'donation' => ['donation_in', 'donation_out'],
                default => [$validated['type']],
            };
            $query->whereHas('transaction', fn ($q) => $q->whereIn('type', $types));
        }
        if (! empty($validated['from'])) {
            $query->where('created_at', '>=', $validated['from']);
        }
        if (! empty($validated['to'])) {
            $query->where('created_at', '<=', $validated['to'].' 23:59:59');
        }

        $perPage = $validated['per_page'] ?? 20;
        $entries = $query->paginate($perPage);

        $entries->getCollection()->transform(function (LedgerEntry $entry) {
            return [
                'id' => $entry->id,
                'type' => $entry->transaction?->type,
                'entry_type' => $entry->entry_type,
                'amount' => $entry->amount,
                'currency' => $entry->currency,
                'formatted' => $this->formatAmount($entry->amount, $entry->currency),
                'balance_before' => $entry->balance_before,
                'balance_after' => $entry->balance_after,
                'description' => $entry->transaction?->description,
                'created_at' => $entry->created_at->toIso8601String(),
            ];
        });

        return response()->json($entries);
    }

    private function formatAmount(int $amount, string $currency): string
    {
        $symbols = ['NGN' => '₦', 'USD' => '$', 'GBP' => '£', 'EUR' => '€'];
        $symbol = $symbols[$currency] ?? $currency.' ';

        return $symbol.number_format($amount / 100, 2);
    }
}
