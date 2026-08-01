<?php

namespace App\Http\Controllers;

use App\Models\AdCampaign;
use App\Models\AdCreative;
use App\Models\AdAnalytics;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $campaigns = AdCampaign::with('creatives')
            ->where('user_id', $request->user()->id)
            ->latest()
            ->paginate(15);
        return response()->json($campaigns);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!in_array($user->role, ['creator', 'vendor', 'admin']) && !$user->is_business) {
            return response()->json(['message' => 'You are not eligible to create advertisements.'], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'objective' => ['required', Rule::in(AdCampaign::OBJECTIVES)],
            'daily_budget' => ['nullable', 'numeric', 'min:0'],
            'total_budget' => ['nullable', 'numeric', 'min:0'],
            'start_date' => ['nullable', 'date', 'after_or_equal:today'],
            'end_date' => ['nullable', 'date', 'after:start_date'],
            'targeting' => ['nullable', 'array'],
            'targeting.country' => ['nullable', 'array'],
            'targeting.region' => ['nullable', 'array'],
            'targeting.city' => ['nullable', 'array'],
            'targeting.age_min' => ['nullable', 'integer', 'min:13', 'max:120'],
            'targeting.age_max' => ['nullable', 'integer', 'min:13', 'max:120'],
            'targeting.language' => ['nullable', 'array'],
            'targeting.interests' => ['nullable', 'array'],
            'targeting.existing_followers' => ['nullable', 'boolean'],
            'targeting.community_members' => ['nullable', 'array'],
            'targeting.lookalike' => ['nullable', 'boolean'],
            'placements' => ['nullable', 'array'],
            'placements.*' => [Rule::in(['home_feed', 'community_feed', 'video_feed', 'marketplace', 'search', 'creator_profile', 'community_recommendations', 'stories', 'mobile', 'desktop_web'])],
            'headline' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'cta_text' => ['nullable', 'string', 'max:100'],
            'destination_url' => ['nullable', 'string', 'url', 'max:500'],
            'media_url' => ['nullable', 'string', 'url', 'max:500'],
            'media_type' => ['nullable', 'string', 'max:50'],
            'promotable_type' => ['nullable', 'string'],
            'promotable_id' => ['nullable', 'integer'],
        ]);

        $campaign = AdCampaign::create([
            'user_id' => $user->id,
            'name' => $validated['name'],
            'objective' => $validated['objective'],
            'status' => 'draft',
            'daily_budget' => $validated['daily_budget'] ?? null,
            'total_budget' => $validated['total_budget'] ?? null,
            'start_date' => $validated['start_date'] ?? null,
            'end_date' => $validated['end_date'] ?? null,
            'targeting' => $validated['targeting'] ?? null,
            'placements' => $validated['placements'] ?? null,
            'review_status' => 'pending',
        ]);

        if ($request->hasAny(['headline', 'description', 'cta_text', 'destination_url', 'media_url', 'promotable_type'])) {
            $creative = AdCreative::create([
                'campaign_id' => $campaign->id,
                'user_id' => $user->id,
                'headline' => $validated['headline'] ?? null,
                'description' => $validated['description'] ?? null,
                'cta_text' => $validated['cta_text'] ?? null,
                'destination_url' => $validated['destination_url'] ?? null,
                'media_url' => $validated['media_url'] ?? null,
                'media_type' => $validated['media_type'] ?? null,
            ]);

            if (!empty($validated['promotable_type']) && !empty($validated['promotable_id'])) {
                $creative->promotable()->associate(
                    app($validated['promotable_type'])::findOrFail($validated['promotable_id'])
                );
                $creative->save();
            }
        }

        $campaign->load('creatives');
        return response()->json(['message' => 'Campaign created.', 'campaign' => $campaign], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::with('creatives', 'analytics')->findOrFail($id);
        if ($campaign->user_id !== $request->user()->id && !$request->user()->isAdmin()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        return response()->json($campaign);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::findOrFail($id);
        if ($campaign->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'objective' => ['sometimes', Rule::in(AdCampaign::OBJECTIVES)],
            'daily_budget' => ['nullable', 'numeric', 'min:0'],
            'total_budget' => ['nullable', 'numeric', 'min:0'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date', 'after:start_date'],
            'targeting' => ['nullable', 'array'],
            'placements' => ['nullable', 'array'],
        ]);

        $campaign->update($validated);
        return response()->json(['message' => 'Campaign updated.', 'campaign' => $campaign->load('creatives')]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::findOrFail($id);
        if ($campaign->user_id !== $request->user()->id && !$request->user()->isAdmin()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $campaign->delete();
        return response()->json(['message' => 'Campaign cancelled.']);
    }

    public function pause(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::findOrFail($id);
        if ($campaign->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $campaign->update(['status' => 'paused']);
        return response()->json(['message' => 'Campaign paused.', 'campaign' => $campaign]);
    }

    public function resume(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::findOrFail($id);
        if ($campaign->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if ($campaign->review_status !== 'approved') {
            return response()->json(['message' => 'Campaign must be approved before resuming.'], 403);
        }
        $campaign->update(['status' => 'active']);
        return response()->json(['message' => 'Campaign resumed.', 'campaign' => $campaign]);
    }

    public function duplicate(Request $request, int $id): JsonResponse
    {
        $original = AdCampaign::with('creatives')->findOrFail($id);
        if ($original->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $campaign = $original->replicate();
        $campaign->name = $original->name . ' (Copy)';
        $campaign->status = 'draft';
        $campaign->review_status = 'pending';
        $campaign->save();

        foreach ($original->creatives as $creative) {
            $dup = $creative->replicate();
            $dup->campaign_id = $campaign->id;
            $dup->save();
        }

        $campaign->load('creatives');
        return response()->json(['message' => 'Campaign duplicated.', 'campaign' => $campaign], 201);
    }

    public function preview(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::with('creatives')->findOrFail($id);
        if ($campaign->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        return response()->json(['preview' => $campaign]);
    }

    public function submit(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::findOrFail($id);
        if ($campaign->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if (empty($campaign->creatives()->count())) {
            return response()->json(['message' => 'Add at least one creative before submitting.'], 422);
        }
        $campaign->update(['status' => 'active', 'review_status' => 'pending']);
        return response()->json(['message' => 'Campaign submitted for review.', 'campaign' => $campaign]);
    }

    public function analytics(Request $request, int $id): JsonResponse
    {
        $campaign = AdCampaign::findOrFail($id);
        if ($campaign->user_id !== $request->user()->id && !$request->user()->isAdmin()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $stats = AdAnalytics::where('campaign_id', $campaign->id)
            ->selectRaw('
                SUM(impressions) as total_impressions,
                SUM(reach) as total_reach,
                SUM(clicks) as total_clicks,
                SUM(reactions) as total_reactions,
                SUM(comments) as total_comments,
                SUM(shares) as total_shares,
                SUM(follows) as total_follows,
                SUM(community_joins) as total_community_joins,
                SUM(product_views) as total_product_views,
                SUM(purchases) as total_purchases,
                SUM(messages_received) as total_messages,
                SUM(video_views) as total_video_views,
                SUM(amount_spent) as total_spent
            ')->first();

        $daily = AdAnalytics::where('campaign_id', $campaign->id)
            ->orderBy('date', 'desc')
            ->limit(30)
            ->get();

        $ctr = $stats->total_impressions > 0
            ? round(($stats->total_clicks / $stats->total_impressions) * 100, 2)
            : 0;

        $cpc = $stats->total_clicks > 0
            ? round($stats->total_spent / $stats->total_clicks, 4)
            : 0;

        $cpe = ($stats->total_reactions + $stats->total_comments + $stats->total_shares) > 0
            ? round($stats->total_spent / ($stats->total_reactions + $stats->total_comments + $stats->total_shares), 4)
            : 0;

        return response()->json([
            'summary' => $stats,
            'daily' => $daily,
            'ctr' => $ctr,
            'cpc' => $cpc,
            'cpe' => $cpe,
            'remaining_budget' => $campaign->total_budget ? max(0, $campaign->total_budget - $stats->total_spent) : null,
        ]);
    }
}
