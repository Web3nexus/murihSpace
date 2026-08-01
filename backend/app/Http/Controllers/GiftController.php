<?php

namespace App\Http\Controllers;

use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\CreatorWallet;
use App\Models\CreatorPayout;
use App\Models\Wallet;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class GiftController extends Controller
{
    public function __construct(private readonly NotificationService $notifications)
    {
    }

    public function catalogue(Request $request): JsonResponse
    {
        $gifts = Gift::active()->get();
        return response()->json($gifts);
    }

    public function send(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'gift_id' => ['required', 'exists:gifts,id'],
            'recipient_id' => ['required', 'exists:users,id', 'different:sender_id'],
            'giftable_type' => ['required', 'string'],
            'giftable_id' => ['required', 'integer'],
            'is_anonymous' => ['nullable', 'boolean'],
            'sender_display_name' => ['nullable', 'string', 'max:100'],
            'message' => ['nullable', 'string', 'max:500'],
            'is_public' => ['nullable', 'boolean'],
            'idempotency_key' => ['required', 'string', 'max:100', 'unique:gift_transactions,idempotency_key'],
        ]);

        $user = $request->user();
        $gift = Gift::findOrFail($validated['gift_id']);
        $recipient = \App\Models\User::findOrFail($validated['recipient_id']);

        if (!$recipient->isCreator()) {
            return response()->json(['message' => 'Recipient is not eligible to receive gifts.'], 422);
        }

        $creatorWallet = CreatorWallet::firstOrCreate(
            ['user_id' => $recipient->id],
            [
                'total_gifts_received' => 0, 'gross_earnings' => 0,
                'platform_fees' => 0, 'net_earnings' => 0,
                'pending_balance' => 0, 'available_balance' => 0,
                'withdrawn_balance' => 0,
            ]
        );

        if (!$creatorWallet->gifting_enabled) {
            return response()->json(['message' => 'This creator is not currently accepting gifts.'], 422);
        }

        $senderWallet = Wallet::where('user_id', $user->id)->first();
        if (!$senderWallet || $senderWallet->balance < $gift->coin_price) {
            return response()->json(['message' => 'Insufficient balance.'], 422);
        }

        $transaction = DB::transaction(function () use ($user, $recipient, $gift, $validated, $creatorWallet, $senderWallet) {
            $senderWallet->decrement('balance', $gift->coin_price);

            $creatorWallet->increment('total_gifts_received');
            $creatorWallet->increment('gross_earnings', $gift->coin_price);
            $creatorWallet->increment('platform_fees', $gift->platform_commission);
            $creatorWallet->increment('net_earnings', $gift->creator_earns);
            $creatorWallet->increment('pending_balance', $gift->creator_earns);

            return GiftTransaction::create([
                'sender_id' => $user->id,
                'recipient_id' => $recipient->id,
                'gift_id' => $gift->id,
                'giftable_type' => $validated['giftable_type'],
                'giftable_id' => $validated['giftable_id'],
                'coin_price' => $gift->coin_price,
                'creator_earns' => $gift->creator_earns,
                'platform_commission' => $gift->platform_commission,
                'status' => 'completed',
                'is_anonymous' => $validated['is_anonymous'] ?? false,
                'sender_display_name' => $validated['sender_display_name'] ?? $user->name,
                'message' => $validated['message'] ?? null,
                'is_public' => $validated['is_public'] ?? true,
                'idempotency_key' => $validated['idempotency_key'],
            ]);
        });

        $transaction->load(['gift', 'sender:id,name,username,avatar']);
        return response()->json(['message' => 'Gift sent!', 'transaction' => $transaction], 201);
    }

    public function transactions(Request $request): JsonResponse
    {
        $query = GiftTransaction::with(['gift', 'sender:id,name,username,avatar', 'recipient:id,name,username,avatar']);
        if ($request->user()->isAdmin()) {
            $transactions = $query->latest()->paginate(15);
        } else {
            $transactions = $query->where('sender_id', $request->user()->id)
                ->orWhere('recipient_id', $request->user()->id)
                ->latest()
                ->paginate(15);
        }
        return response()->json($transactions);
    }

    public function wallet(Request $request): JsonResponse
    {
        $wallet = CreatorWallet::firstOrCreate(
            ['user_id' => $request->user()->id],
            [
                'total_gifts_received' => 0, 'gross_earnings' => 0,
                'platform_fees' => 0, 'net_earnings' => 0,
                'pending_balance' => 0, 'available_balance' => 0,
                'withdrawn_balance' => 0,
            ]
        );

        $recentGifts = GiftTransaction::with(['gift', 'sender:id,name,username,avatar'])
            ->where('recipient_id', $request->user()->id)
            ->latest()
            ->limit(20)
            ->get();

        $topGifts = GiftTransaction::where('recipient_id', $request->user()->id)
            ->selectRaw('gift_id, COUNT(*) as count, SUM(coin_price) as total')
            ->groupBy('gift_id')
            ->with('gift')
            ->orderByDesc('count')
            ->limit(10)
            ->get();

        return response()->json([
            'wallet' => $wallet,
            'recent_gifts' => $recentGifts,
            'top_gifts' => $topGifts,
        ]);
    }

    public function requestPayout(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasVerifiedKyc()) {
            return response()->json([
                'message' => 'Complete KYC identity verification before requesting a payout.',
                'code' => 'KYC_REQUIRED',
            ], 403);
        }

        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['required', 'string', 'max:50'],
            'payment_details' => ['required', 'string', 'max:500'],
        ]);

        $wallet = CreatorWallet::where('user_id', $request->user()->id)->firstOrFail();
        $minPayout = config('murihspace.min_payout', 1000);

        if ($validated['amount'] > $wallet->available_balance) {
            return response()->json(['message' => 'Insufficient available balance.'], 422);
        }
        if ($validated['amount'] < $minPayout) {
            return response()->json(['message' => "Minimum payout amount is {$minPayout}."], 422);
        }

        $payout = DB::transaction(function () use ($request, $validated, $wallet) {
            $wallet->decrement('available_balance', $validated['amount']);
            $wallet->increment('pending_balance', $validated['amount']);

            return CreatorPayout::create([
                'user_id' => $request->user()->id,
                'amount' => $validated['amount'],
                'platform_fee' => 0,
                'net_amount' => $validated['amount'],
                'payment_method' => $validated['payment_method'],
                'payment_details' => $validated['payment_details'],
                'status' => 'pending',
            ]);
        });

        return response()->json(['message' => 'Payout requested.', 'payout' => $payout], 201);
    }

    public function payouts(Request $request): JsonResponse
    {
        $payouts = CreatorPayout::where('user_id', $request->user()->id)->latest()->paginate(15);
        return response()->json($payouts);
    }

    public function adminGifts(Request $request): JsonResponse
    {
        return response()->json(Gift::orderBy('sort_order')->get());
    }

    public function adminStoreGift(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'icon_url' => ['nullable', 'string', 'url', 'max:500'],
            'animation_url' => ['nullable', 'string', 'url', 'max:500'],
            'coin_price' => ['required', 'integer', 'min:1'],
            'creator_earns' => ['required', 'integer', 'min:0'],
            'platform_commission' => ['required', 'integer', 'min:0'],
            'category' => ['required', Rule::in(Gift::CATEGORIES)],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $gift = Gift::create($validated);
        return response()->json(['message' => 'Gift created.', 'gift' => $gift], 201);
    }

    public function adminUpdateGift(Request $request, int $id): JsonResponse
    {
        $gift = Gift::findOrFail($id);
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'icon_url' => ['nullable', 'string', 'url', 'max:500'],
            'animation_url' => ['nullable', 'string', 'url', 'max:500'],
            'coin_price' => ['sometimes', 'integer', 'min:1'],
            'creator_earns' => ['sometimes', 'integer', 'min:0'],
            'platform_commission' => ['sometimes', 'integer', 'min:0'],
            'category' => ['sometimes', Rule::in(Gift::CATEGORIES)],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $gift->update($validated);
        return response()->json(['message' => 'Gift updated.', 'gift' => $gift]);
    }

    public function adminDeleteGift(Request $request, int $id): JsonResponse
    {
        Gift::findOrFail($id)->delete();
        return response()->json(['message' => 'Gift removed.']);
    }

    public function adminReorderGifts(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'order' => ['required', 'array'],
            'order.*.id' => ['required', 'exists:gifts,id'],
            'order.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        foreach ($validated['order'] as $item) {
            Gift::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        return response()->json(['message' => 'Gift order updated.']);
    }

    public function adminPayouts(Request $request): JsonResponse
    {
        $payouts = CreatorPayout::with('user:id,name,username')->latest()->paginate(20);
        return response()->json($payouts);
    }

    public function adminApprovePayout(Request $request, int $id): JsonResponse
    {
        $payout = CreatorPayout::findOrFail($id);
        $payout->update([
            'status' => 'approved',
            'approved_by' => $request->user()->id,
            'approved_at' => now(),
        ]);

        $user = \App\Models\User::find($payout->user_id);
        $this->notifications->actionEmail(
            user: $user,
            title: 'Your payout request has been approved',
            bodyHtml: '<p>Your payout request of <strong>'.e('MSH').' '.number_format((float) $payout->amount, 2).'</strong> has been <strong>approved</strong>. It will be paid out shortly.</p>',
        );

        return response()->json(['message' => 'Payout approved.', 'payout' => $payout]);
    }

    public function adminRejectPayout(Request $request, int $id): JsonResponse
    {
        $payout = CreatorPayout::findOrFail($id);
        $wallet = CreatorWallet::where('user_id', $payout->user_id)->first();

        DB::transaction(function () use ($payout, $wallet, $request) {
            $payout->update([
                'status' => 'rejected',
                'admin_notes' => $request->input('reason'),
            ]);
            if ($wallet) {
                $wallet->decrement('pending_balance', $payout->amount);
                $wallet->increment('available_balance', $payout->amount);
            }
        });

        $user = \App\Models\User::find($payout->user_id);
        $this->notifications->actionEmail(
            user: $user,
            title: 'Your payout request was declined',
            bodyHtml: '<p>Your payout request of <strong>'.e('MSH').' '.number_format((float) $payout->amount, 2).'</strong> was not approved and the amount has been returned to your wallet.</p>',
            actionLabel: 'View wallet',
            actionUrl: NotificationService::link('wallet'),
        );

        return response()->json(['message' => 'Payout rejected.']);
    }

    public function adminMarkPaid(Request $request, int $id): JsonResponse
    {
        $payout = CreatorPayout::findOrFail($id);
        $wallet = CreatorWallet::where('user_id', $payout->user_id)->first();

        $user = \App\Models\User::find($payout->user_id);
        if ($user && ! $user->hasVerifiedKyc()) {
            return response()->json([
                'message' => 'This user has not completed KYC identity verification. Payouts are blocked until KYC is verified.',
                'code' => 'KYC_REQUIRED',
            ], 403);
        }

        DB::transaction(function () use ($payout, $wallet, $request) {
            $payout->update([
                'status' => 'paid',
                'paid_at' => now(),
            ]);
            if ($wallet) {
                $wallet->decrement('pending_balance', $payout->amount);
                $wallet->increment('withdrawn_balance', $payout->amount);
            }
        });

        $this->notifications->actionEmail(
            user: $user,
            title: 'Your payout has been paid',
            bodyHtml: '<p>Your payout of <strong>'.e('MSH').' '.number_format((float) $payout->amount, 2).'</strong> has been <strong>paid</strong> and is on its way to your account.</p>',
            actionLabel: 'View payout history',
            actionUrl: NotificationService::link('settings/payouts'),
        );

        return response()->json(['message' => 'Payout marked as paid.']);
    }

    public function adminStats(Request $request): JsonResponse
    {
        $stats = GiftTransaction::selectRaw('
            COUNT(*) as total_transactions,
            SUM(coin_price) as total_volume,
            SUM(platform_commission) as total_commission
        ')->first();

        return response()->json($stats);
    }

    public function adminToggleGifting(Request $request, int $userId): JsonResponse
    {
        $wallet = CreatorWallet::where('user_id', $userId)->firstOrFail();
        $wallet->update(['gifting_enabled' => !$wallet->gifting_enabled]);
        return response()->json(['message' => 'Gifting toggled.', 'gifting_enabled' => $wallet->gifting_enabled]);
    }
}
