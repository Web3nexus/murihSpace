<?php

namespace App\Http\Controllers;

use App\Models\Badge;
use App\Models\UserBadge;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BadgeController extends Controller
{
    public function index(): JsonResponse
    {
        $badges = Badge::active()->get();

        return response()->json(['data' => $badges]);
    }

    public function myBadges(Request $request): JsonResponse
    {
        $badges = UserBadge::where('user_id', $request->user()->id)
            ->with('badge')
            ->latest('earned_at')
            ->get()
            ->map(fn ($ub) => [
                'id' => $ub->id,
                'badge_id' => $ub->badge_id,
                'earned_at' => $ub->earned_at->toIso8601String(),
                'badge' => $ub->badge ? [
                    'slug' => $ub->badge->slug,
                    'name' => $ub->badge->name,
                    'description' => $ub->badge->description,
                    'icon' => $ub->badge->icon,
                    'color' => $ub->badge->color,
                ] : null,
            ]);

        return response()->json(['data' => $badges]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:100', 'unique:badges,slug'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'icon' => ['nullable', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:20'],
            'criteria' => ['nullable', 'array'],
        ]);

        $badge = Badge::create($validated);

        return response()->json(['data' => $badge], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $badge = Badge::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'icon' => ['nullable', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:20'],
            'criteria' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $badge->update($validated);

        return response()->json(['data' => $badge->fresh()]);
    }

    public function destroy(int $id): JsonResponse
    {
        Badge::findOrFail($id)->delete();

        return response()->json(['message' => 'Badge deleted.']);
    }

    public function earn(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'badge_id' => ['required', 'integer', 'exists:badges,id'],
        ]);

        $existing = UserBadge::where('user_id', $request->user()->id)
            ->where('badge_id', $validated['badge_id'])
            ->first();

        if ($existing) {
            return response()->json(['message' => 'Badge already earned.'], 409);
        }

        $ub = UserBadge::create([
            'user_id' => $request->user()->id,
            'badge_id' => $validated['badge_id'],
            'earned_at' => now(),
        ]);

        $ub->load('badge');

        return response()->json(['data' => [
            'id' => $ub->id,
            'earned_at' => $ub->earned_at->toIso8601String(),
            'badge' => $ub->badge ? [
                'slug' => $ub->badge->slug,
                'name' => $ub->badge->name,
                'description' => $ub->badge->description,
                'icon' => $ub->badge->icon,
                'color' => $ub->badge->color,
            ] : null,
        ]], 201);
    }

    public function seed(): JsonResponse
    {
        $defaults = [
            ['slug' => 'first-sale', 'name' => 'First Sale', 'description' => 'Made your first sale on Murihspace', 'icon' => 'shopping-bag', 'color' => '#38A8D8', 'criteria' => ['metric' => 'sales', 'value' => 1]],
            ['slug' => 'rising-star', 'name' => 'Rising Star', 'description' => 'Reached 100 followers', 'icon' => 'trending-up', 'color' => '#10B981', 'criteria' => ['metric' => 'followers', 'value' => 100]],
            ['slug' => 'top-creator', 'name' => 'Top Creator', 'description' => 'Reached 1,000 followers', 'icon' => 'award', 'color' => '#F59E0B', 'criteria' => ['metric' => 'followers', 'value' => 1000]],
            ['slug' => 'best-seller', 'name' => 'Best Seller', 'description' => 'Sold 50 products', 'icon' => 'badge-percent', 'color' => '#8B5CF6', 'criteria' => ['metric' => 'products', 'value' => 50]],
            ['slug' => 'earner', 'name' => 'Earner', 'description' => 'Earned over ₦100,000', 'icon' => 'wallet', 'color' => '#EC4899', 'criteria' => ['metric' => 'revenue', 'value' => 10000000]],
            ['slug' => 'engaged', 'name' => 'Highly Engaged', 'description' => 'Received 500 total engagements', 'icon' => 'heart', 'color' => '#EF4444', 'criteria' => ['metric' => 'engagement', 'value' => 500]],
        ];

        $created = 0;
        foreach ($defaults as $badge) {
            Badge::firstOrCreate(['slug' => $badge['slug']], $badge);
            $created++;
        }

        return response()->json(['message' => "$created badges seeded."]);
    }
}
