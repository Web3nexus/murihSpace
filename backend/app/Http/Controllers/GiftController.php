<?php

namespace App\Http\Controllers;

use App\Events\GiftSentEvent;
use App\Exceptions\InsufficientBalanceException;
use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\NotificationService;
use App\Services\Wallet\FeeCalculatorService;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class GiftController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly LedgerService $ledgerService,
        private readonly WalletService $walletService,
        private readonly FeeCalculatorService $feeCalculator,
    ) {}

    public function catalogue(Request $request): JsonResponse
    {
        $gifts = Gift::active()->get();

        return response()->json($gifts);
    }

    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gift_id'             => ['required', 'exists:gifts,id'],
            'recipient_id'        => ['required', 'exists:users,id'],
            'giftable_type'       => ['nullable', 'string', 'required_with:giftable_id', Rule::in(array_keys(Relation::morphMap()))],
            'giftable_id'         => ['nullable', 'integer', 'required_with:giftable_type'],
            'session_id'          => ['nullable', 'string'],
            'is_anonymous'        => ['nullable', 'boolean'],
            'sender_display_name' => ['nullable', 'string', 'max:100'],
            'message'             => ['nullable', 'string', 'max:500'],
            'is_public'           => ['nullable', 'boolean'],
            'idempotency_key'     => ['nullable', 'string', 'max:100'],
            'wallet_type'         => ['nullable', 'string', 'in:system,creator,business'],
        ]);

        $user      = $request->user();
        $recipient = User::findOrFail($validated['recipient_id']);

        if ($user->id === $recipient->id) {
            return response()->json(['message' => 'Cannot send gifts to yourself.', 'code' => 'SELF_GIFT'], 422);
        }

        $gift       = Gift::findOrFail($validated['gift_id']);
        $walletType = $validated['wallet_type'] ?? 'system';

        // RULE: Senders CANNOT spend directly from Creator or Business wallets
        if ($walletType !== 'system') {
            return response()->json([
                'message' => 'Gifts can only be sent using your System Wallet balance. Please transfer creator or business earnings to your System Wallet first.',
                'code'    => 'SYSTEM_WALLET_REQUIRED',
            ], 403);
        }

        $senderWallet = $this->walletService->getOrCreateWallet($user, 'system');
        $grossAmount  = (int) $gift->coin_price; // in minor units (kobo)
        $idemKey      = $validated['idempotency_key'] ?? ('GIFT-' . Str::uuid());
        $sessionId    = $validated['session_id'] ?? null;

        // Calculate receiving fee before the transaction so we can validate it
        $feeRes   = $this->feeCalculator->calculate('GIFT_RECEIVING', $grossAmount, $senderWallet->currency);
        $feeAmt   = $feeRes['fee_amount'];
        $netEarns = $feeRes['net_amount'];

        $isAnonymous = (bool) ($validated['is_anonymous'] ?? false);
        $senderLabel = $isAnonymous
            ? ($validated['sender_display_name'] ?: 'Someone')
            : '@' . $user->username;

        $isNew = false;
        try {
            $transaction = DB::transaction(function () use ($user, $recipient, $gift, $validated, $senderWallet, $grossAmount, $feeAmt, $netEarns, $idemKey, $sessionId, &$isNew) {
                // Idempotency check inside transaction with lock to prevent race conditions
                $existing = GiftTransaction::where('sender_id', $user->id)
                    ->where('idempotency_key', $idemKey)
                    ->lockForUpdate()
                    ->first();
                if ($existing) {
                    // Verify the stored transaction matches the current request — a reused key
                    // with a different payload must not be served as a successful duplicate.
                    if ((int) $existing->gift_id !== $gift->id
                        || (int) $existing->recipient_id !== $recipient->id
                        || (int) $existing->sender_id !== $user->id) {
                        throw new \RuntimeException('Idempotency key was already used for a different gift.');
                    }
                    return $existing;
                }
                $isNew = true;

                // Pessimistic balance check inside transaction using locked wallet row
                $locked = Wallet::whereKey($senderWallet->id)->lockForUpdate()->firstOrFail();
                if ($locked->available < $grossAmount) {
                    throw new InsufficientBalanceException('Insufficient System Wallet available balance.');
                }

                // Debit Sender System Wallet
                $this->ledgerService->debit(
                    user: $user,
                    amount: $grossAmount,
                    currency: $senderWallet->currency,
                    walletType: 'system',
                    balanceCategory: 'available',
                    type: 'donation_out',
                    description: "Gift sent to @{$recipient->username}: {$gift->name}",
                    idempotencyKey: $idemKey . '-debit'
                );

                // Credit Recipient Creator Wallet
                $this->ledgerService->credit(
                    user: $recipient,
                    amount: $netEarns,
                    currency: $senderWallet->currency,
                    walletType: 'creator',
                    balanceCategory: 'available',
                    type: 'creator_gift_receipt',
                    description: "Gift received from @{$user->username}: {$gift->name} (Net: {$netEarns}, Fee: {$feeAmt})",
                    idempotencyKey: $idemKey . '-credit',
                    metadata: ['sender_id' => $user->id, 'gift_id' => $gift->id, 'fee_amount' => $feeAmt]
                );

                // Credit the platform revenue account with the receiving fee so the ledger
                // stays balanced: debit(gross) == credit(net) + credit(fee).
                if ($feeAmt > 0) {
                    $this->ledgerService->creditPlatformRevenue(
                        amount: $feeAmt,
                        currency: $senderWallet->currency,
                        description: "Gift receiving fee for gift #{$gift->id}",
                        idempotencyKey: $idemKey . '-fee',
                        metadata: ['sender_id' => $user->id, 'recipient_id' => $recipient->id, 'gift_id' => $gift->id]
                    );
                }

                return GiftTransaction::create([
                    'sender_id'           => $user->id,
                    'recipient_id'        => $recipient->id,
                    'gift_id'             => $gift->id,
                    'giftable_type'       => $validated['giftable_type'] ?? null,
                    'giftable_id'         => $validated['giftable_id'] ?? null,
                    'session_id'          => $sessionId,
                    'coin_price'          => $grossAmount,
                    'creator_earns'       => $netEarns,
                    'platform_commission' => $feeAmt,
                    'status'              => 'completed',
                    'is_anonymous'        => $validated['is_anonymous'] ?? false,
                    'sender_display_name' => (!empty($validated['is_anonymous']) && empty($validated['sender_display_name'])) ? 'Someone' : ($validated['sender_display_name'] ?? $user->name),
                    'message'             => $validated['message'] ?? null,
                    'is_public'           => $validated['is_public'] ?? true,
                    'idempotency_key'     => $idemKey,
                ]);
            });
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        // Determine animation tier
        $animationType = match (true) {
            $grossAmount >= 500000 => 'full_screen', // ₦5,000+
            $grossAmount >= 100000 => 'premium',     // ₦1,000+
            $grossAmount >= 20000  => 'standard',    // ₦200+
            default                => 'micro',
        };

        // Broadcast real-time WebSocket event + notify recipient — only for newly created transactions
        if ($isNew) {
            event(new GiftSentEvent(
                sender: $user,
                recipient: $recipient,
                gift: $gift,
                amount: $grossAmount,
                currency: $senderWallet->currency,
                sessionId: $validated['session_id'] ?? null,
                animationType: $animationType,
                isAnonymous: $isAnonymous,
                senderDisplayName: $validated['sender_display_name'] ?? null,
            ));

            $this->notifications->actionEmail(
                user: $recipient,
                title: 'Gift Received!',
                bodyHtml: "<p>" . e($senderLabel) . " sent you a <strong>" . e($gift->name) . "</strong> gift!</p>",
                template: 'gift_received'
            );
        }

        $transaction->load(['gift', 'sender:id,name,username,avatar']);

        return response()->json([
            'message'        => 'Gift sent successfully!',
            'transaction'    => $transaction,
            'animation_type' => $animationType,
        ], 201);
    }

    public function leaderboard(Request $request, string $sessionId): JsonResponse
    {
        // Filter on the stored session_id column directly.
        // session_id is persisted on every GiftTransaction at creation time.
        $topGifters = GiftTransaction::select('sender_id', DB::raw('SUM(coin_price) as total_sent'), DB::raw('COUNT(*) as total_gifts'))
            ->where('session_id', $sessionId)
            ->where('status', 'completed')
            ->where('is_anonymous', false)
            ->groupBy('sender_id')
            ->orderBy('total_sent', 'desc')
            ->with('sender:id,name,username,avatar')
            ->limit(10)
            ->get();

        return response()->json([
            'data' => $topGifters,
        ]);
    }

    public function transactions(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $transactions = GiftTransaction::where('sender_id', $request->user()->id)
            ->orWhere('recipient_id', $request->user()->id)
            ->with(['gift', 'sender:id,name,username', 'recipient:id,name,username'])
            ->latest()
            ->paginate($validated['per_page'] ?? 20);

        return response()->json($transactions);
    }
}
