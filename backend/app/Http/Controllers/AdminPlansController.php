<?php

namespace App\Http\Controllers;

use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPlansController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $plans = SubscriptionPlan::with('creator:id,name,username')
            ->withCount(['subscriptions as subscriber_count' => fn ($q) => $q->where('status', 'active')->where('current_period_end', '>', now())])
            ->latest()
            ->paginate(50);

        $summary = [
            'total_plans' => SubscriptionPlan::count(),
            'active_plans' => SubscriptionPlan::where('is_active', true)->count(),
            'total_subscribers' => Subscription::where('status', 'active')
                ->where('current_period_end', '>', now())
                ->count(),
            'mrr' => Subscription::where('status', 'active')
                ->where('current_period_end', '>', now())
                ->sum('amount'),
            'creators_with_plans' => SubscriptionPlan::distinct('creator_id')->count('creator_id'),
        ];

        return response()->json(['data' => $plans, 'summary' => $summary]);
    }

    public function show(int $id): JsonResponse
    {
        $plan = SubscriptionPlan::with([
            'creator:id,name,username,email',
            'community:id,name,slug',
            'subscriptions' => fn ($q) => $q->with('user:id,name,username,email')
                ->where('status', 'active')
                ->where('current_period_end', '>', now())
                ->latest(),
        ])->findOrFail($id);

        return response()->json(['data' => $plan]);
    }

    public function toggleActive(int $id): JsonResponse
    {
        $plan = SubscriptionPlan::findOrFail($id);
        $plan->update(['is_active' => !$plan->is_active]);

        return response()->json(['data' => $plan]);
    }
}
