<?php

namespace App\Http\Controllers;

use App\Models\AdCampaign;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminAdController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $campaigns = AdCampaign::with(['user:id,name,username,role', 'creatives'])
            ->latest()
            ->paginate(20);
        return response()->json($campaigns);
    }

    public function approve(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::findOrFail($id);
        $campaign->update([
            'review_status' => 'approved',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'review_notes' => $request->input('notes'),
        ]);
        return response()->json(['message' => 'Campaign approved.', 'campaign' => $campaign]);
    }

    public function reject(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $campaign = AdCampaign::findOrFail($id);
        $campaign->update([
            'review_status' => 'rejected',
            'status' => 'paused',
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'review_notes' => $validated['reason'],
        ]);
        return response()->json(['message' => 'Campaign rejected.', 'campaign' => $campaign]);
    }

    public function suspend(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::findOrFail($id);
        $campaign->update([
            'review_status' => 'suspended',
            'status' => 'paused',
            'review_notes' => $request->input('reason'),
        ]);
        return response()->json(['message' => 'Campaign suspended.']);
    }

    public function remove(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::findOrFail($id);
        $campaign->update([
            'review_status' => 'removed',
            'status' => 'cancelled',
        ]);
        $campaign->delete();
        return response()->json(['message' => 'Campaign removed permanently.']);
    }

    public function stats(Request $request): JsonResponse
    {
        $stats = AdCampaign::selectRaw('
            COUNT(*) as total_campaigns,
            SUM(CASE WHEN status = "active" THEN 1 ELSE 0 END) as active_campaigns,
            SUM(CASE WHEN review_status = "pending" THEN 1 ELSE 0 END) as pending_review
        ')->first();

        return response()->json($stats);
    }

    public function revenue(Request $request): JsonResponse
    {
        $revenue = \App\Models\AdAnalytics::selectRaw('
            SUM(amount_spent) as total_revenue,
            COUNT(DISTINCT campaign_id) as active_campaigns
        ')->first();

        return response()->json($revenue);
    }
}
