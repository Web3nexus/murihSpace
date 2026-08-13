<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Events\NotificationBroadcast;
use App\Models\AuditLog;
use App\Models\CreatorWallet;
use App\Models\FulfilmentOrder;
use App\Models\KycVerification;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\NotificationPreference;
use App\Models\Order;
use App\Models\Subscription;
use App\Models\User;
use App\Models\Wallet;
use App\Notifications\CustomerTicketNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SupportInternalController extends Controller
{
    /**
     * GET /internal/support/users/{user}/summary
     */
    public function userSummary(Request $request, User $user): JsonResponse
    {
        $this->audit($request, 'internal.user.summary', 'user', $user->id);

        return response()->json(['success' => true, 'data' => $this->userSummaryShape($user)]);
    }

    /**
     * GET /internal/support/users/by-email/{email}
     *
     * Resolve a customer from their account email (e.g. read from a ticket).
     * Returns the same shape as userSummary, or a 404 with data:null when no
     * account matches.
     */
    public function userByEmail(Request $request, string $email): JsonResponse
    {
        $user = User::query()->where('email', $email)->first();

        if (! $user) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'User not found.',
            ], 404);
        }

        $this->audit($request, 'internal.user.summary', 'user', $user->id);

        return response()->json(['success' => true, 'data' => $this->userSummaryShape($user)]);
    }

    /**
     * GET /internal/support/users/{user}/transactions
     */
    public function userTransactions(Request $request, User $user): JsonResponse
    {
        $this->audit($request, 'internal.user.transactions', 'user', $user->id);

        $entries = LedgerEntry::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->limit(50)
            ->get();

        $transactions = LedgerTransaction::query()
            ->whereIn('id', $entries->pluck('ledger_transaction_id'))
            ->get()
            ->keyBy('id');

        $rows = $entries->map(fn (LedgerEntry $entry) => [
            'transaction_id' => $entry->ledger_transaction_id,
            'type' => $transactions->get($entry->ledger_transaction_id)?->type,
            'status' => $transactions->get($entry->ledger_transaction_id)?->status,
            'description' => $transactions->get($entry->ledger_transaction_id)?->description,
            'account_type' => $entry->account_type,
            'wallet_type' => $entry->wallet_type,
            'balance_category' => $entry->balance_category,
            'entry_type' => $entry->entry_type,
            'amount' => $entry->amount,
            'currency' => $entry->currency,
            'balance_after' => $entry->balance_after,
            'created_at' => $transactions->get($entry->ledger_transaction_id)?->created_at?->toISOString(),
        ]);

        return response()->json(['success' => true, 'data' => $rows]);
    }

    private function userSummaryShape(User $user): array
    {
        return [
            'id' => $user->id,
            'uuid' => $user->uuid,
            'name' => $user->name,
            'username' => $user->username,
            'email' => $user->email,
            'avatar_url' => $user->avatar_url,
            'role' => $user->role,
            'status' => $user->status,
            'country' => $user->country,
            'mobile_number' => $user->mobile_number,
            'kyc_status' => $user->kyc_status,
            'verification_badge_status' => $user->verification_badge_status,
            'has_verified_email' => $user->hasVerifiedEmail(),
            'has_verified_phone' => $user->hasVerifiedPhone(),
            'created_at' => $user->created_at?->toISOString(),
            'updated_at' => $user->updated_at?->toISOString(),
        ];
    }

    /**
     * GET /internal/support/users/{user}/orders
     */
    public function userOrders(Request $request, User $user): JsonResponse
    {
        $this->audit($request, 'internal.user.orders', 'user', $user->id);

        $orders = Order::query()
            ->where('buyer_id', $user->id)
            ->with(['product'])
            ->latest('created_at')
            ->get()
            ->map(fn (Order $order) => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'product' => $order->product?->name,
                'status' => $order->status,
                'currency' => $order->currency,
                'total' => $order->total,
                'payment_provider' => $order->payment_provider,
                'paid_at' => $order->paid_at?->toISOString(),
                'created_at' => $order->created_at?->toISOString(),
            ]);

        return response()->json(['success' => true, 'data' => $orders]);
    }

    /**
     * GET /internal/support/users/{user}/subscriptions
     */
    public function userSubscriptions(Request $request, User $user): JsonResponse
    {
        $this->audit($request, 'internal.user.subscriptions', 'user', $user->id);

        $subscriptions = Subscription::query()
            ->where('subscriber_id', $user->id)
            ->with(['plan'])
            ->latest('created_at')
            ->get()
            ->map(fn (Subscription $subscription) => [
                'id' => $subscription->id,
                'plan_name' => $subscription->plan?->name,
                'creator_id' => $subscription->creator_id,
                'status' => $subscription->status,
                'active' => $subscription->isActive(),
                'on_trial' => $subscription->isOnTrial(),
                'days_remaining' => $subscription->daysRemaining(),
                'current_period_start' => $subscription->current_period_start?->toISOString(),
                'current_period_end' => $subscription->current_period_end?->toISOString(),
                'canceled_at' => $subscription->canceled_at?->toISOString(),
            ]);

        return response()->json(['success' => true, 'data' => $subscriptions]);
    }

    /**
     * GET /internal/support/users/{user}/wallet-summary
     */
    public function userWalletSummary(Request $request, User $user): JsonResponse
    {
        $this->audit($request, 'internal.user.wallet', 'user', $user->id);

        $wallets = Wallet::query()
            ->where('user_id', $user->id)
            ->get()
            ->map->only([
                'wallet_type', 'available', 'pending', 'reserved', 'escrow',
                'withdrawable', 'non_withdrawable', 'disputed', 'currency', 'status',
            ]);

        $creatorWallet = CreatorWallet::query()->where('user_id', $user->id)->first();

        return response()->json([
            'success' => true,
            'data' => [
                'wallets' => $wallets,
                'creator_wallet' => $creatorWallet?->only([
                    'total_gifts_received', 'gross_earnings', 'platform_fees',
                    'net_earnings', 'pending_balance', 'available_balance',
                    'withdrawn_balance', 'status', 'gifting_enabled',
                ]),
            ],
        ]);
    }

    /**
     * GET /internal/support/users/{user}/kyc-summary
     */
    public function userKycSummary(Request $request, User $user): JsonResponse
    {
        $this->audit($request, 'internal.user.kyc', 'user', $user->id);

        $verifications = KycVerification::query()
            ->where('user_id', $user->id)
            ->latest('id')
            ->get()
            ->map(fn (KycVerification $verification) => [
                'id' => $verification->id,
                'provider' => $verification->provider,
                'status' => $verification->status,
                'started_at' => $verification->started_at?->toISOString(),
                'completed_at' => $verification->completed_at?->toISOString(),
                'expires_at' => $verification->expires_at?->toISOString(),
                'rejection_reason' => $verification->rejection_reason,
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'kyc_status' => $user->kyc_status,
                'verifications' => $verifications,
                'latest' => $verifications->first(),
            ],
        ]);
    }

    /**
     * GET /internal/support/transactions/{transaction}/summary
     */
    public function transactionSummary(Request $request, LedgerTransaction $transaction): JsonResponse
    {
        $this->audit($request, 'internal.transaction.summary', 'transaction', $transaction->id);

        $transaction->load('entries');

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $transaction->id,
                'ulid' => $transaction->ulid,
                'type' => $transaction->type,
                'status' => $transaction->status,
                'description' => $transaction->description,
                'created_at' => $transaction->created_at?->toISOString(),
                'balanced' => $transaction->isBalanced(),
                'entries' => $transaction->entries->map(fn ($entry) => [
                    'id' => $entry->id,
                    'user_id' => $entry->user_id,
                    'account_type' => $entry->account_type,
                    'wallet_type' => $entry->wallet_type,
                    'balance_category' => $entry->balance_category,
                    'entry_type' => $entry->entry_type,
                    'amount' => $entry->amount,
                    'currency' => $entry->currency,
                    'balance_before' => $entry->balance_before,
                    'balance_after' => $entry->balance_after,
                ]),
            ],
        ]);
    }

    /**
     * GET /internal/support/orders/{order}
     */
    public function orderSummary(Request $request, Order $order): JsonResponse
    {
        $this->audit($request, 'internal.order.summary', 'order', $order->id);

        $order->load(['buyer:id,name,email', 'product']);

        $fulfilment = FulfilmentOrder::query()
            ->where('buyer_id', $order->buyer_id)
            ->latest('created_at')
            ->get()
            ->map(fn (FulfilmentOrder $f) => [
                'id' => $f->id,
                'order_number' => $f->order_number,
                'status' => $f->status,
                'total' => $f->total,
                'currency' => $f->currency,
                'tracking_number' => $f->tracking_number,
                'carrier' => $f->carrier,
                'estimated_delivery' => $f->estimated_delivery?->toDateString(),
                'shipped_at' => $f->shipped_at?->toISOString(),
                'delivered_at' => $f->delivered_at?->toISOString(),
            ]);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'buyer' => $order->buyer ? [
                    'id' => $order->buyer->id,
                    'name' => $order->buyer->name,
                    'email' => $order->buyer->email,
                ] : null,
                'product' => $order->product?->name,
                'status' => $order->status,
                'currency' => $order->currency,
                'subtotal' => $order->subtotal,
                'platform_fee' => $order->platform_fee,
                'tax' => $order->tax,
                'total' => $order->total,
                'paid_at' => $order->paid_at?->toISOString(),
                'created_at' => $order->created_at?->toISOString(),
                'fulfilment_orders' => $fulfilment,
            ],
        ]);
    }

    /**
     * POST /internal/support/notifications
     *
     * Create an in-app (and email, where enabled) notification for a customer,
     * plus a realtime broadcast. Called by marketing-backend when a ticket
     * lifecycle event happens (created / agent replied / status changed /
     * more info requested / resolved / reopened).
     */
    public function notifyCustomer(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'type' => ['required', Rule::in(NotificationPreference::TYPES)],
            'title' => ['required', 'string', 'max:255'],
            'message' => ['required', 'string', 'max:2000'],
            'action_url' => ['nullable', 'string', 'max:500'],
            'ticket_number' => ['nullable', 'string', 'max:50'],
        ]);

        $user = User::query()->where('email', $validated['email'])->first();

        if (! $user) {
            // Customer may not have a platform account (e.g. help-centre form
            // submissions with a plain email). Nothing to deliver in-app.
            return response()->json([
                'success' => true,
                'delivered' => false,
                'reason' => 'user_not_found',
            ]);
        }

        $this->audit($request, 'internal.notification.create', 'user', $user->id);

        $user->notify(new CustomerTicketNotification(
            $validated['type'],
            $validated['title'],
            $validated['message'],
            $validated['action_url'] ?? null,
            $validated['ticket_number'] ?? null,
        ));

        if ($this->inAppEnabled($user, $validated['type'])) {
            try {
                NotificationBroadcast::dispatch($user->id, [
                    'type' => $validated['type'],
                    'title' => $validated['title'],
                    'message' => $validated['message'],
                    'action_url' => $validated['action_url'] ?? null,
                    'ticket_number' => $validated['ticket_number'] ?? null,
                ]);
            } catch (\Throwable) {
                // Realtime is best-effort: the notification row is already
                // persisted above, so a down Reverb must not fail the request.
            }
        }

        return response()->json([
            'success' => true,
            'delivered' => true,
            'user_id' => $user->id,
        ]);
    }

    /**
     * In-app is the default channel; customers can opt out per type.
     */
    private function inAppEnabled(User $user, string $type): bool
    {
        $preference = NotificationPreference::query()
            ->where('user_id', $user->id)
            ->where('type', $type)
            ->where('channel', 'in_app')
            ->first();

        return $preference?->enabled ?? true;
    }

    private function audit(Request $request, string $action, string $resourceType, int|string $resourceId): void
    {
        DB::transaction(function () use ($request, $action, $resourceType, $resourceId) {
            AuditLog::create([
                'user_id' => null,
                'action' => $action,
                'resource_type' => $resourceType,
                'resource_id' => (string) $resourceId,
                'metadata' => [
                    'service' => 'marketing-backend',
                    'ip' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                ],
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
        });
    }
}
