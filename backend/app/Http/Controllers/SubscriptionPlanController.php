<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionPlanController extends Controller
{
    public function indexPublic(Request $request): JsonResponse
    {
        $plans = SubscriptionPlan::with('creator:id,name,username,avatar_url')
            ->active()
            ->public()
            ->orderBy('sort_order')
            ->orderBy('price')
            ->get();

        return response()->json(['data' => $plans]);
    }

    public function indexForCreator(Request $request, int $creatorId): JsonResponse
    {
        $plans = SubscriptionPlan::with('community:id,name,slug')
            ->forCreator($creatorId)
            ->orderBy('sort_order')
            ->orderBy('price')
            ->get()
            ->map(fn ($plan) => [
                ...$plan->toArray(),
                'active_subscribers' => $plan->activeSubscribersCount(),
            ]);

        return response()->json(['data' => $plans]);
    }

    public function myPlans(Request $request): JsonResponse
    {
        return $this->indexForCreator($request, $request->user()->id);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'community_id' => ['nullable', 'integer', 'exists:communities,id'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price' => ['required', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'billing_cycle' => ['nullable', 'in:monthly,yearly'],
            'features' => ['nullable', 'array'],
            'features.*' => ['string', 'max:500'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $validated['creator_id'] = $request->user()->id;
        $validated['currency'] ??= 'NGN';
        $validated['billing_cycle'] ??= 'monthly';

        $plan = SubscriptionPlan::create($validated);

        return response()->json(['data' => $plan], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $plan = SubscriptionPlan::with('creator:id,name,username,avatar_url')
            ->findOrFail($id);

        return response()->json(['data' => $plan]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $plan = SubscriptionPlan::findOrFail($id);

        if ($plan->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'price' => ['sometimes', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'billing_cycle' => ['nullable', 'in:monthly,yearly'],
            'features' => ['nullable', 'array'],
            'features.*' => ['string', 'max:500'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $plan->update($validated);

        return response()->json(['data' => $plan->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $plan = SubscriptionPlan::findOrFail($id);

        if ($plan->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($plan->subscriptions()->where('status', 'active')->exists()) {
            return response()->json([
                'message' => 'Cannot delete a plan with active subscriptions. Deactivate it instead.',
            ], 409);
        }

        $plan->delete();

        return response()->json(['message' => 'Plan deleted.']);
    }
}
