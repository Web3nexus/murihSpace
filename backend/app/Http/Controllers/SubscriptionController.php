<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\Wallet;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubscriptionController extends Controller
{
    public function mySubscriptions(Request $request): JsonResponse
    {
        $subscriptions = Subscription::with([
            'plan:id,name,description,price,currency,billing_cycle,features',
            'creator:id,name,username,avatar',
        ])
            ->forSubscriber($request->user()->id)
            ->latest()
            ->get()
            ->map(fn ($sub) => [
                ...$sub->toArray(),
                'is_active' => $sub->isActive(),
                'days_remaining' => $sub->daysRemaining(),
            ]);

        return response()->json(['data' => $subscriptions]);
    }

    public function mySubscribers(Request $request): JsonResponse
    {
        $subscriptions = Subscription::with([
            'plan:id,name,price,currency,billing_cycle',
            'subscriber:id,name,username,avatar',
        ])
            ->forCreator($request->user()->id)
            ->latest()
            ->paginate(30);

        return response()->json($subscriptions);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'plan_id' => ['required', 'integer', 'exists:subscription_plans,id'],
        ]);

        $plan = SubscriptionPlan::with('creator')->findOrFail($validated['plan_id']);

        if (! $plan->is_active) {
            return response()->json(['message' => 'This plan is no longer available.'], 400);
        }

        $userId = $request->user()->id;

        if ($plan->creator_id === $userId) {
            return response()->json(['message' => 'You cannot subscribe to your own plan.'], 400);
        }

        $existing = Subscription::forSubscriber($userId)
            ->where('plan_id', $plan->id)
            ->whereIn('status', ['active', 'past_due'])
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'You already have an active subscription to this plan.',
                'data' => $existing,
            ], 409);
        }

        $wallet = Wallet::where('user_id', $userId)->first();
        if (! $wallet || $wallet->balance < $plan->price) {
            return response()->json([
                'message' => 'Insufficient wallet balance. Please top up your wallet.',
                'required' => $plan->price,
                'balance' => $wallet?->balance ?? 0,
            ], 402);
        }

        $subscription = DB::transaction(function () use ($plan, $userId, $wallet) {
            $wallet->decrement('balance', $plan->price);

            $periodStart = now();
            $periodEnd = $plan->billing_cycle === 'yearly'
                ? $periodStart->copy()->addYear()
                : $periodStart->copy()->addMonth();

            return Subscription::create([
                'plan_id' => $plan->id,
                'subscriber_id' => $userId,
                'creator_id' => $plan->creator_id,
                'status' => 'active',
                'current_period_start' => $periodStart,
                'current_period_end' => $periodEnd,
                'payment_method' => 'wallet',
            ]);
        });

        $subscription->load([
            'plan:id,name,description,price,currency,billing_cycle,features',
            'creator:id,name,username,avatar',
        ]);

        return response()->json(['data' => $subscription], 201);
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $subscription = Subscription::findOrFail($id);

        if ($subscription->subscriber_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($subscription->status !== 'active') {
            return response()->json(['message' => 'Subscription is not active.'], 400);
        }

        $subscription->update([
            'status' => 'canceled',
            'canceled_at' => now(),
        ]);

        return response()->json([
            'message' => 'Subscription canceled. Access remains until the end of the billing period.',
            'data' => $subscription->fresh(),
        ]);
    }

    public function creatorStats(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $activeSubs = Subscription::forCreator($userId)
            ->where('status', 'active')
            ->where('current_period_end', '>', now())
            ->count();

        $totalRevenue = Subscription::forCreator($userId)
            ->where('status', 'active')
            ->join('subscription_plans', 'subscriptions.plan_id', '=', 'subscription_plans.id')
            ->sum('subscription_plans.price');

        $recentSubs = Subscription::forCreator($userId)
            ->with(['subscriber:id,name,username,avatar', 'plan:id,name'])
            ->latest()
            ->take(10)
            ->get();

        return response()->json([
            'data' => [
                'active_subscribers' => $activeSubs,
                'total_monthly_revenue' => $totalRevenue,
                'recent_subscriptions' => $recentSubs,
            ],
        ]);
    }
}
