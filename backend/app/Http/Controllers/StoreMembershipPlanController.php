<?php

namespace App\Http\Controllers;

use App\Models\StoreMembershipPlan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StoreMembershipPlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $plans = StoreMembershipPlan::where('creator_id', $request->user()->id)
            ->latest()->get();

        return response()->json(['data' => $plans]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'price' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'interval' => ['required', Rule::in(['monthly', 'yearly'])],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:365'],
        ]);

        $plan = StoreMembershipPlan::create([
            'creator_id' => $request->user()->id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'price' => $validated['price'],
            'currency' => strtoupper($validated['currency'] ?? 'USD'),
            'interval' => $validated['interval'],
            'trial_days' => $validated['trial_days'] ?? null,
        ]);

        return response()->json(['data' => $plan], 201);
    }

    public function update(Request $request, StoreMembershipPlan $plan): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'interval' => ['sometimes', Rule::in(['monthly', 'yearly'])],
            'trial_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);

        $plan->update($validated);

        return response()->json(['data' => $plan->fresh()]);
    }

    public function destroy(Request $request, StoreMembershipPlan $plan): JsonResponse
    {
        $plan->delete();
        return response()->json(['message' => 'Plan deleted.']);
    }
}
