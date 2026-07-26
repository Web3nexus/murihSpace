<?php

namespace App\Http\Controllers;

use App\Models\ShippingProfile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShippingProfileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $profiles = ShippingProfile::where('creator_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $profiles]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'base_rate' => ['required', 'integer', 'min:0'],
            'per_item_rate' => ['required', 'integer', 'min:0'],
            'estimated_days_min' => ['required', 'integer', 'min:1', 'max:60'],
            'estimated_days_max' => ['required', 'integer', 'min:1', 'max:60', 'gte:estimated_days_min'],
            'countries' => ['nullable', 'array'],
            'countries.*' => ['string', 'size:2'],
            'currency' => ['nullable', 'string', 'size:3'],
        ]);

        $validated['creator_id'] = $request->user()->id;

        $profile = ShippingProfile::create($validated);

        return response()->json(['data' => $profile], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $profile = ShippingProfile::where('creator_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'base_rate' => ['sometimes', 'integer', 'min:0'],
            'per_item_rate' => ['sometimes', 'integer', 'min:0'],
            'estimated_days_min' => ['sometimes', 'integer', 'min:1', 'max:60'],
            'estimated_days_max' => ['sometimes', 'integer', 'min:1', 'max:60', 'gte:estimated_days_min'],
            'countries' => ['nullable', 'array'],
            'countries.*' => ['string', 'size:2'],
            'currency' => ['nullable', 'string', 'size:3'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $profile->update($validated);

        return response()->json(['data' => $profile->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $profile = ShippingProfile::where('creator_id', $request->user()->id)->findOrFail($id);
        $profile->delete();

        return response()->json(['message' => 'Shipping profile deleted.']);
    }

    public function estimate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'creator_id' => ['required', 'integer', 'exists:users,id'],
            'item_count' => ['required', 'integer', 'min:1'],
            'country' => ['nullable', 'string', 'size:2'],
        ]);

        $profiles = ShippingProfile::where('creator_id', $validated['creator_id'])
            ->active()
            ->where(function ($q) use ($validated) {
                if (isset($validated['country'])) {
                    $q->whereNull('countries')
                      ->orWhereJsonContains('countries', $validated['country']);
                }
            })
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'cost' => $p->calculateCost($validated['item_count']),
                'currency' => $p->currency,
                'estimated_days_min' => $p->estimated_days_min,
                'estimated_days_max' => $p->estimated_days_max,
            ]);

        return response()->json(['data' => $profiles]);
    }
}
