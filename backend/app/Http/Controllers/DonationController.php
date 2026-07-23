<?php

namespace App\Http\Controllers;

use App\Models\Donation;
use App\Models\User;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DonationController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
    ) {}

    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'recipient_username' => ['required', 'string', 'max:255', 'exists:users,username'],
            'amount'             => ['required', 'integer', 'min:1'],
            'currency'           => ['nullable', 'string', 'max:3'],
            'message'            => ['nullable', 'string', 'max:500'],
            'is_anonymous'       => ['nullable', 'boolean'],
            'pin'                => ['required', 'string', 'digits:4'],
        ]);

        $sender = $request->user();
        $recipient = User::where('username', $validated['recipient_username'])->firstOrFail();

        if ($sender->id === $recipient->id) {
            return response()->json(['message' => 'Cannot donate to yourself.', 'code' => 'SELF_DONATION'], 422);
        }

        $wallet = $this->ledgerService->getOrCreateWallet($sender->id);

        if (! $wallet->verifyPin($validated['pin'])) {
            return response()->json(['message' => 'Incorrect transaction PIN.', 'code' => 'INVALID_TRANSACTION_PIN'], 403);
        }

        $currency = $validated['currency'] ?? 'NGN';
        $isAnonymous = $validated['is_anonymous'] ?? false;

        $ledgerTxn = $this->ledgerService->transfer(
            $sender->id,
            $recipient->id,
            $validated['amount'],
            $currency,
            "Donation to @{$recipient->username}" . ($validated['message'] ? ": {$validated['message']}" : ''),
            ['donation' => true, 'anonymous' => $isAnonymous],
        );

        $donation = Donation::create([
            'sender_id'             => $sender->id,
            'recipient_id'          => $recipient->id,
            'amount'                => $validated['amount'],
            'currency'              => $currency,
            'message'               => $validated['message'],
            'is_anonymous'          => $isAnonymous,
            'status'                => 'completed',
            'ledger_transaction_id' => $ledgerTxn->id,
        ]);

        return response()->json([
            'message' => 'Donation sent successfully.',
            'data'    => $donation->fresh(['sender:id,name,username', 'recipient:id,name,username']),
        ], 201);
    }

    public function sent(Request $request): JsonResponse
    {
        $donations = Donation::where('sender_id', $request->user()->id)
            ->with(['recipient:id,name,username'])
            ->latest()
            ->paginate(20);

        return response()->json($donations);
    }

    public function received(Request $request): JsonResponse
    {
        $donations = Donation::where('recipient_id', $request->user()->id)
            ->with(['sender:id,name,username'])
            ->latest()
            ->paginate(20);

        return response()->json($donations);
    }
}
