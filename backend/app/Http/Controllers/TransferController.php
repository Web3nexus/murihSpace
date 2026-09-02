<?php

namespace App\Http\Controllers;

use App\Models\Transfer;
use App\Models\User;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransferController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
    ) {}

    public function send(Request $request): JsonResponse
    {
        $sender = $request->user();

        if (! $sender->hasVerifiedKyc()) {
            return response()->json([
                'message' => 'Complete KYC identity verification before sending money.',
                'code' => 'KYC_REQUIRED',
            ], 403);
        }

        $validated = $request->validate([
            'recipient_username' => ['required', 'string', 'max:255', 'exists:users,username'],
            'amount' => ['required', 'integer', 'min:1'],
            'currency' => ['nullable', 'string', 'max:3'],
            'note' => ['nullable', 'string', 'max:255'],
            'pin' => ['required', 'string', 'digits:4'],
        ]);

        $recipient = User::where('username', $validated['recipient_username'])->firstOrFail();

        if ($sender->id === $recipient->id) {
            return response()->json(['message' => 'Cannot transfer to yourself.', 'code' => 'SELF_TRANSFER'], 422);
        }

        $walletService = new \App\Services\Wallet\WalletService();
        $wallet = $walletService->getOrCreateWallet($sender, 'system');

        if (! $wallet->verifyPin($validated['pin'])) {
            return response()->json(['message' => 'Incorrect transaction PIN.', 'code' => 'INVALID_TRANSACTION_PIN'], 403);
        }

        $currency = $validated['currency'] ?? 'NGN';
        $note = $validated['note'] ?? null;

        $ledgerTxn = $this->ledgerService->transfer(
            $sender->id,
            $recipient->id,
            $validated['amount'],
            $currency,
            "Transfer to @{$recipient->username}".($note ? ": {$note}" : ''),
        );

        $transfer = Transfer::create([
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'amount' => $validated['amount'],
            'currency' => $currency,
            'note' => $note,
            'status' => 'completed',
            'ledger_transaction_id' => $ledgerTxn->id,
        ]);

        // Official In-App Notification with Blue Badge
        try {
            $formattedAmt = number_format($validated['amount'] / 100, 2);
            $recipient->notify(new \App\Notifications\MurihOfficialNotification(
                type: 'money_received',
                title: '💰 Money Received!',
                body: "You received {$currency} {$formattedAmt} from @{$sender->username}!" . ($note ? " Note: {$note}" : ''),
                actionUrl: \App\Services\NotificationService::link('app/wallet'),
                actionLabel: 'View Wallet',
                route: '/wallet',
                metadata: [
                    'amount' => $validated['amount'],
                    'currency' => $currency,
                    'sender_id' => $sender->id,
                    'sender_username' => $sender->username,
                    'note' => $note,
                ]
            ));
        } catch (\Throwable $e) {
            \Log::warning("Transfer in-app notification failed: {$e->getMessage()}");
        }

        return response()->json([
            'message' => 'Transfer completed successfully.',
            'data' => $transfer->fresh(['sender:id,name,username', 'recipient:id,name,username']),
        ], 201);
    }

    public function sent(Request $request): JsonResponse
    {
        $transfers = Transfer::where('sender_id', $request->user()->id)
            ->with(['sender:id,name,username', 'recipient:id,name,username'])
            ->latest()
            ->paginate(20);

        return response()->json($transfers);
    }

    public function received(Request $request): JsonResponse
    {
        $transfers = Transfer::where('recipient_id', $request->user()->id)
            ->with(['sender:id,name,username', 'recipient:id,name,username'])
            ->latest()
            ->paginate(20);

        return response()->json($transfers);
    }
}
