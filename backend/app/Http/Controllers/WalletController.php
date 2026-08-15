<?php

namespace App\Http\Controllers;

use App\Models\DepositTransaction;
use App\Models\LedgerEntry;
use App\Models\Wallet;
use App\Services\Wallet\FeeCalculatorService;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class WalletController extends Controller
{
    public function __construct(
        private readonly LedgerService $ledgerService,
        private readonly WalletService $walletService,
        private readonly FeeCalculatorService $feeCalculator,
    ) {}

    /**
     * GET /api/v1/wallet
     * List all wallets for the authenticated user (System, Creator, Business).
     */
    public function index(Request $request): JsonResponse
    {
        $user    = $request->user();
        $wallets = $this->walletService->getUserWallets($user);

        $data = $wallets->map(fn (Wallet $w) => $this->formatWalletData($w));

        return response()->json([
            'data' => $data,
        ]);
    }

    /**
     * GET /api/v1/wallet/{type}
     * Get a single wallet by type (system, creator, business).
     */
    public function showByType(Request $request, string $type = 'system'): JsonResponse
    {
        $user   = $request->user();
        $wallet = $this->walletService->getOrCreateWallet($user, $type);

        return response()->json([
            'data' => $this->formatWalletData($wallet),
        ]);
    }

    /**
     * POST /api/v1/wallet/deposit
     * Idempotent cash deposit into System Wallet.
     */
    public function deposit(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'amount'            => ['required', 'integer', 'min:100'], // in minor units (e.g. 100 kobo = NGN 1)
            'currency'          => ['nullable', 'string', 'size:3', 'alpha'],
            'payment_gateway'   => ['nullable', 'string', 'in:paystack,flutterwave,stripe'],
            'idempotency_key'   => ['nullable', 'string', 'max:100'],
        ]);

        $user     = $request->user();

        // Safety gate: direct deposits bypass the payment gateway.
        // Restrict to local/testing environments until the webhook confirmation
        // flow is wired up (POST /checkout/webhooks/{provider}).
        if (! app()->environment(['local', 'testing'])) {
            return response()->json([
                'message' => 'Direct wallet deposits are not available. Use the payment gateway checkout flow.',
                'code'    => 'GATEWAY_REQUIRED',
            ], 403);
        }

        // Resolve wallet first to enforce currency consistency.
        // Reject if the request currency doesn't match the existing wallet currency.
        $requested   = strtoupper($validated['currency'] ?? 'NGN');
        $walletCheck = $this->walletService->getOrCreateWallet($user, 'system', $requested);

        if ($walletCheck->currency !== $requested) {
            return response()->json([
                'message' => "Currency mismatch: system wallet is in {$walletCheck->currency}.",
                'code'    => 'CURRENCY_MISMATCH',
            ], 422);
        }

        $currency = $walletCheck->currency;

        $idemKey  = $validated['idempotency_key'] ?? ('DEP-' . Str::uuid());
        $gateway  = $validated['payment_gateway'] ?? 'paystack';
        $gross    = (int) $validated['amount'];

        // Fee calculation
        $feeRes   = $this->feeCalculator->calculate('DEPOSIT_' . strtoupper($gateway), $gross, $currency);
        $feeAmt   = $feeRes['fee_amount'];
        $netAmt   = $feeRes['net_amount'];

        // Idempotency: return early for any existing row regardless of status
        $existing = DepositTransaction::where('idempotency_key', $idemKey)->first();
        if ($existing) {
            return response()->json([
                'message' => 'Deposit already recorded.',
                'data'    => $existing,
            ], $existing->status === 'completed' ? 200 : 409);
        }

        $gatewayRef = 'REF-' . Str::upper(Str::random(12));

        try {
            $deposit = DB::transaction(function () use ($user, $idemKey, $gateway, $gatewayRef, $gross, $feeAmt, $netAmt, $currency) {
                $deposit = DepositTransaction::create([
                    'user_id'            => $user->id,
                    'wallet_type'        => 'system',
                    'idempotency_key'    => $idemKey,
                    'payment_gateway'    => $gateway,
                    'gateway_reference'  => $gatewayRef,
                    'amount'             => $gross,
                    'fee_amount'         => $feeAmt,
                    'net_amount'         => $netAmt,
                    'currency'           => $currency,
                    'status'             => 'completed',
                    'wallet_credited_at' => now(),
                ]);

                // Record in ledger within the same transaction so a failed credit
                // cannot leave a completed deposit row with no ledger entry.
                $txn = $this->ledgerService->credit(
                    user: $user,
                    amount: $netAmt,
                    currency: $currency,
                    walletType: 'system',
                    balanceCategory: 'available',
                    type: 'deposit',
                    description: "Cash deposit via {$gateway} (Net: {$netAmt}, Fee: {$feeAmt})",
                    idempotencyKey: $idemKey,
                    metadata: ['gateway' => $gateway, 'gateway_reference' => $gatewayRef, 'gross' => $gross, 'fee' => $feeAmt]
                );

                $deposit->update(['ledger_transaction_id' => $txn->id]);

                return $deposit;
            });
        } catch (UniqueConstraintViolationException $e) {
            // A concurrent request with the same idempotency_key won the race.
            $existing = DepositTransaction::where('idempotency_key', $idemKey)->firstOrFail();

            return response()->json([
                'message' => 'Deposit already recorded.',
                'data'    => $existing,
            ], $existing->status === 'completed' ? 200 : 409);
        }

        $wallet = $this->walletService->getOrCreateWallet($user, 'system', $currency);

        return response()->json([
            'message' => 'Deposit successful.',
            'data'    => [
                'deposit' => $deposit,
                'wallet'  => $this->formatWalletData($wallet->fresh()),
            ],
        ], 201);
    }

    /**
     * POST /api/v1/wallet/internal-transfer
     * Transfer funds from Creator / Business Wallet to System Wallet.
     */
    public function internalTransfer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from_wallet_type' => ['required', 'string', 'in:creator,business'],
            'to_wallet_type'   => ['nullable', 'string', 'in:system'],
            'amount'           => ['required', 'integer', 'min:100'],
            'idempotency_key'   => ['nullable', 'string', 'max:100'],
            'pin'              => ['nullable', 'string', 'digits:4'],
        ]);

        $user           = $request->user();
        $fromWalletType = $validated['from_wallet_type'];
        $toWalletType   = $validated['to_wallet_type'] ?? 'system';
        $amount         = (int) $validated['amount'];
        $idemKey        = $validated['idempotency_key'] ?? ('ITX-' . Str::uuid());

        // Verify PIN if set on system wallet
        $systemWallet = $this->walletService->getOrCreateWallet($user, 'system');
        if ($systemWallet->hasPin()) {
            if (empty($validated['pin']) || ! $systemWallet->verifyPin($validated['pin'])) {
                return response()->json(['message' => 'Invalid transaction PIN.', 'code' => 'INVALID_TRANSACTION_PIN'], 403);
            }
        }

        // Fee calculation for internal transfer
        $feeRes = $this->feeCalculator->calculate('INTERNAL_TRANSFER', $amount, $systemWallet->currency);
        $feeAmt = $feeRes['fee_amount'];

        try {
            $txn = $this->ledgerService->internalTransfer(
                user: $user,
                fromWalletType: $fromWalletType,
                toWalletType: $toWalletType,
                amount: $amount,
                feeAmount: $feeAmt,
                currency: $systemWallet->currency,
                idempotencyKey: $idemKey
            );

            $updatedWallets = $this->walletService->getUserWallets($user);

            return response()->json([
                'message' => 'Internal transfer completed successfully.',
                'data'    => [
                    'transaction' => $txn,
                    'wallets'     => $updatedWallets->map(fn (Wallet $w) => $this->formatWalletData($w)),
                ],
            ]);
        } catch (\RuntimeException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code'    => 'INTERNAL_TRANSFER_FAILED',
            ], 422);
        } catch (\Throwable $e) {
            report($e);
            return response()->json([
                'message' => 'Internal transfer could not be completed.',
                'code'    => 'INTERNAL_TRANSFER_ERROR',
            ], 500);
        }
    }

    public function setupPin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pin' => ['required', 'string', 'digits:4'],
        ]);

        $wallet = $this->walletService->getOrCreateWallet($request->user(), 'system');

        if ($wallet->hasPin()) {
            return response()->json(['message' => 'PIN already set.', 'code' => 'PIN_ALREADY_SET'], 409);
        }

        $wallet->update([
            'pin_hash'   => Hash::make($validated['pin']),
            'pin_set_at' => now(),
        ]);

        return response()->json(['message' => 'Transaction PIN set successfully.', 'data' => ['has_pin' => true]]);
    }

    public function updatePin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_pin' => ['required', 'string', 'digits:4'],
            'new_pin'     => ['required', 'string', 'digits:4'],
        ]);

        $wallet = $this->walletService->getOrCreateWallet($request->user(), 'system');

        if (! $wallet->verifyPin($validated['current_pin'])) {
            return response()->json(['message' => 'Current PIN is incorrect.', 'code' => 'INVALID_TRANSACTION_PIN'], 403);
        }

        $wallet->update([
            'pin_hash'   => Hash::make($validated['new_pin']),
            'pin_set_at' => now(),
        ]);

        return response()->json(['message' => 'Transaction PIN updated successfully.', 'data' => ['has_pin' => true]]);
    }

    public function verifyPin(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'pin' => ['required', 'string', 'digits:4'],
        ]);

        $wallet = $this->walletService->getOrCreateWallet($request->user(), 'system');

        if (! $wallet->verifyPin($validated['pin'])) {
            return response()->json(['message' => 'PIN is incorrect.', 'code' => 'INVALID_TRANSACTION_PIN'], 403);
        }

        return response()->json(['message' => 'PIN verified successfully.']);
    }

    public function pinStatus(Request $request): JsonResponse
    {
        $wallet = $this->walletService->getOrCreateWallet($request->user(), 'system');

        return response()->json([
            'data' => [
                'has_pin'    => $wallet->hasPin(),
                'pin_set_at' => $wallet->pin_set_at?->toIso8601String(),
            ],
        ]);
    }

    public function transactions(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'wallet_type' => ['nullable', 'string', 'in:system,creator,business'],
            'type'        => ['nullable', 'string'],
            'from'        => ['nullable', 'date'],
            'to'          => ['nullable', 'date'],
            'per_page'    => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = LedgerEntry::where('user_id', $request->user()->id)
            ->with('transaction')
            ->latest();

        if (! empty($validated['wallet_type'])) {
            $query->where('wallet_type', $validated['wallet_type']);
        }

        if (! empty($validated['type'])) {
            $types = match ($validated['type']) {
                'transfer' => ['transfer_in', 'transfer_out', 'internal_transfer'],
                'donation' => ['donation_in', 'donation_out'],
                default    => [$validated['type']],
            };
            $query->whereHas('transaction', fn ($q) => $q->whereIn('type', $types));
        }

        if (! empty($validated['from'])) {
            $query->where('created_at', '>=', \Illuminate\Support\Carbon::parse($validated['from'])->startOfDay());
        }
        if (! empty($validated['to'])) {
            $query->where('created_at', '<=', \Illuminate\Support\Carbon::parse($validated['to'])->endOfDay());
        }

        $perPage = $validated['per_page'] ?? 20;
        $entries = $query->paginate($perPage);

        $entries->getCollection()->transform(function (LedgerEntry $entry) {
            return [
                'id'               => $entry->id,
                'wallet_type'      => $entry->wallet_type,
                'balance_category' => $entry->balance_category,
                'type'             => $entry->transaction?->type,
                'entry_type'       => $entry->entry_type,
                'amount'           => $entry->amount,
                'currency'         => $entry->currency,
                'formatted'        => $this->formatAmount($entry->amount, $entry->currency),
                'balance_before'   => $entry->balance_before,
                'balance_after'    => $entry->balance_after,
                'description'      => $entry->transaction?->description,
                'created_at'       => $entry->created_at->toIso8601String(),
            ];
        });

        return response()->json($entries);
    }

    public function overview(Request $request): JsonResponse
    {
        return $this->index($request);
    }

    public function show(Request $request): JsonResponse
    {
        return $this->showByType($request, 'system');
    }

    private function formatWalletData(Wallet $w): array
    {
        return [
            'id'               => $w->id,
            'wallet_type'      => $w->wallet_type,
            'available'        => $w->available,
            'pending'          => $w->pending,
            'reserved'         => $w->reserved,
            'escrow'           => $w->escrow,
            'withdrawable'     => $w->withdrawable,
            'non_withdrawable' => $w->non_withdrawable,
            'disputed'         => $w->disputed,
            'total'            => $w->totalBalance(),
            'currency'         => $w->currency,
            'formatted'        => [
                'available'    => $this->formatAmount($w->available, $w->currency),
                'pending'      => $this->formatAmount($w->pending, $w->currency),
                'reserved'     => $this->formatAmount($w->reserved, $w->currency),
                'escrow'       => $this->formatAmount($w->escrow, $w->currency),
                'total'        => $this->formatAmount($w->totalBalance(), $w->currency),
            ],
            'has_pin'          => $w->hasPin(),
            'status'           => $w->status,
        ];
    }

    private function formatAmount(int $amount, string $currency): string
    {
        $symbols = ['NGN' => '₦', 'USD' => '$', 'GBP' => '£', 'EUR' => '€'];
        $symbol  = $symbols[$currency] ?? $currency . ' ';

        return $symbol . number_format($amount / 100, 2);
    }
}
