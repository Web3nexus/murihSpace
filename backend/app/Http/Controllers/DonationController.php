<?php

namespace App\Http\Controllers;

use App\Models\Donation;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DonationController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
        private readonly NotificationService $notifications,
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
            'message' => ['nullable', 'string', 'max:500'],
            'is_anonymous' => ['nullable', 'boolean'],
            'pin' => ['required', 'string', 'digits:4'],
        ]);

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
            "Donation to @{$recipient->username}".(($validated['message'] ?? '') ? ": {$validated['message']}" : ''),
            ['donation' => true, 'anonymous' => $isAnonymous],
        );

        $donation = Donation::create([
            'sender_id' => $sender->id,
            'recipient_id' => $recipient->id,
            'amount' => $validated['amount'],
            'currency' => $currency,
            'message' => $validated['message'] ?? null,
            'is_anonymous' => $isAnonymous,
            'status' => 'completed',
            'ledger_transaction_id' => $ledgerTxn->id,
        ]);

        try {
            $donorName = $isAnonymous ? 'Anonymous' : $sender->name;
            $this->notifications->actionEmail(
                user: $recipient,
                title: 'You received a donation of '.e($currency).' '.number_format((float) $validated['amount'], 2),
                bodyHtml: '<p>You received a donation of <strong>'.e($currency).' '.number_format((float) $validated['amount'], 2).'</strong> from '.e($donorName).'.</p>'.(($validated['message'] ?? '') ? '<blockquote style="margin:0; padding:12px 16px; border-left:3px solid #10B981; background:#ECFDF5; border-radius:8px; color:#4B5563;">'.e($validated['message']).'</blockquote>' : ''),
                actionLabel: 'View wallet',
                actionUrl: NotificationService::link('app/wallet'),
                template: 'donation_received',
                data: [
                    'from_name' => e($donorName),
                    'currency' => e($currency),
                    'amount' => number_format((float) $validated['amount'], 2),
                    'message' => $validated['message'] ?? '',
                ],
            );
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => 'Donation sent successfully.',
            'data' => $donation->fresh(['sender:id,name,username', 'recipient:id,name,username']),
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
