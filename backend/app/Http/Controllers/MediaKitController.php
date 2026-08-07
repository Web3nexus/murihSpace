<?php

namespace App\Http\Controllers;

use App\Models\MediaKit;
use App\Models\ReferralLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MediaKitController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $kit = MediaKit::where('creator_id', $request->user()->id)->first();

        if (!$kit) {
            $kit = MediaKit::create(['creator_id' => $request->user()->id]);
        }

        return response()->json(['data' => $kit]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'bio' => ['nullable', 'string', 'max:2000'],
            'profile_image_url' => ['nullable', 'url', 'max:500'],
            'audience_demographics' => ['nullable', 'array'],
            'engagement_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'total_followers' => ['nullable', 'integer', 'min:0'],
            'avg_views' => ['nullable', 'integer', 'min:0'],
            'top_content' => ['nullable', 'array'],
            'top_content.*' => ['string'],
            'past_partnerships' => ['nullable', 'array'],
            'rate_card' => ['nullable', 'array'],
            'is_published' => ['sometimes', 'boolean'],
        ]);

        $kit = MediaKit::updateOrCreate(
            ['creator_id' => $request->user()->id],
            $validated,
        );

        return response()->json(['data' => $kit]);
    }

    public function publicShow(int $creatorId): JsonResponse
    {
        $kit = MediaKit::where('creator_id', $creatorId)
            ->where('is_published', true)
            ->firstOrFail();

        return response()->json(['data' => $kit]);
    }

    public function preview(Request $request): JsonResponse
    {
        $kit = MediaKit::where('creator_id', $request->user()->id)->first();

        if (!$kit) {
            $kit = MediaKit::create(['creator_id' => $request->user()->id]);
        }

        $user = $request->user()->loadCount(['communities', 'products', 'followers']);

        $totalFollowers = $user->followers_count ?? 0;
        $linkCount = max(ReferralLink::where('creator_id', $request->user()->id)->count(), 1);
        $avgViews = ReferralLink::where('creator_id', $request->user()->id)->sum('clicks') / $linkCount;
        $engagementRate = $totalFollowers > 0
            ? round(min(($avgViews / $totalFollowers) * 100, 100), 2)
            : 0;

        $suggested = [
            'total_followers' => $totalFollowers,
            'avg_views' => $avgViews,
            'engagement_rate' => $engagementRate,
            'total_products' => $user->products_count ?? 0,
            'total_communities' => $user->communities_count ?? 0,
            'member_since' => $user->created_at->format('Y-m-d'),
        ];

        return response()->json([
            'data' => $kit,
            'suggested' => $suggested,
        ]);
    }
}
