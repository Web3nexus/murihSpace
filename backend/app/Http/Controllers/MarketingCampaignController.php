<?php

namespace App\Http\Controllers;

use App\Models\MarketingCampaign;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MarketingCampaignController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $campaigns = MarketingCampaign::where('creator_id', $request->user()->id)
            ->latest()->get();

        return response()->json(['data' => $campaigns]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['email', 'social', 'ads'])],
            'status' => ['sometimes', Rule::in(['draft', 'active', 'completed', 'cancelled'])],
        ]);

        $campaign = MarketingCampaign::create([
            'creator_id' => $request->user()->id,
            'name' => $validated['name'],
            'type' => $validated['type'],
            'status' => $validated['status'] ?? 'draft',
        ]);

        return response()->json(['data' => $campaign], 201);
    }

    public function show(Request $request, MarketingCampaign $campaign): JsonResponse
    {
        if ($campaign->creator_id !== $request->user()->id) abort(403);
        return response()->json(['data' => $campaign]);
    }

    public function update(Request $request, MarketingCampaign $campaign): JsonResponse
    {
        if ($campaign->creator_id !== $request->user()->id) abort(403);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'type' => ['sometimes', Rule::in(['email', 'social', 'ads'])],
            'status' => ['sometimes', Rule::in(['draft', 'active', 'completed', 'cancelled'])],
        ]);

        $campaign->update($validated);

        return response()->json(['data' => $campaign->fresh()]);
    }

    public function destroy(Request $request, MarketingCampaign $campaign): JsonResponse
    {
        if ($campaign->creator_id !== $request->user()->id) abort(403);
        $campaign->delete();
        return response()->json(['message' => 'Campaign deleted.']);
    }
}
