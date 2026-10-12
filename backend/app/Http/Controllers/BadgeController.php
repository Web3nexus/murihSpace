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

    public function adminIndex(Request $request): JsonResponse
    {
        $query = Badge::withCount('users');

        if ($request->filled('search')) {
            $s = '%' . $request->search . '%';
            $query->where(fn ($q) => $q->where('name', 'like', $s)->orWhere('slug', 'like', $s)->orWhere('description', 'like', $s));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        $badges = $query->latest()->get();

        return response()->json([
            'data' => $badges,
            'total' => $badges->count(),
            'stats' => [
                'total_badges' => Badge::count(),
                'active_badges' => Badge::where('is_active', true)->count(),
                'total_awarded' => UserBadge::count(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'slug' => ['required', 'string', 'max:100', 'unique:badges,slug'],
            'name' => ['required', 'string', 'max:255'],
            'level_label' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'icon' => ['nullable', 'string', 'max:100'],
            'icon_3d' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:30'],
            'icon_gradient' => ['nullable', 'string', 'max:100'],
            'criteria' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $badge = Badge::create($validated);

        return response()->json(['data' => $badge], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $badge = Badge::findOrFail($id);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'level_label' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'icon' => ['nullable', 'string', 'max:100'],
            'icon_3d' => ['nullable', 'string', 'max:50'],
            'color' => ['nullable', 'string', 'max:30'],
            'icon_gradient' => ['nullable', 'string', 'max:100'],
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

    public function awardUser(Request $request, int $id): JsonResponse
    {
        $badge = Badge::findOrFail($id);

        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $ub = UserBadge::firstOrCreate(
            ['user_id' => $validated['user_id'], 'badge_id' => $badge->id],
            ['earned_at' => now()]
        );

        if ($ub->wasRecentlyCreated) {
            $badge->increment('awarded_count');
        }

        return response()->json([
            'success' => true,
            'message' => "Badge '{$badge->name}' awarded successfully.",
            'data' => $ub,
        ]);
    }

    public function revokeUser(Request $request, int $id, int $userId): JsonResponse
    {
        $badge = Badge::findOrFail($id);

        $deleted = UserBadge::where('badge_id', $badge->id)->where('user_id', $userId)->delete();

        if ($deleted) {
            $badge->decrement('awarded_count');
        }

        return response()->json([
            'success' => true,
            'message' => "Badge revoked from user.",
        ]);
    }

    /**
     * Automated Rule Engine: Evaluate whether a user has met criteria for any badges.
     */
    public function evaluateUserBadges(\App\Models\User $user): void
    {
        $activeBadges = Badge::active()->whereNotNull('criteria')->get();

        $followersCount = $user->followers()->count();
        $postsCount = $user->posts()->count();
        $ordersCount = \App\Models\Order::where('buyer_id', $user->id)->count();
        $salesCount = \App\Models\Order::whereHas('items.physicalProduct', fn ($q) => $q->where('creator_id', $user->id))->count();
        $isKycVerified = $user->kyc_status === 'verified';
        $hasActiveEscrow = \App\Models\EscrowTransaction::where(fn ($q) => $q->where('buyer_id', $user->id)->orWhere('seller_id', $user->id))->where('status', 'completed')->exists();
        $isCreator = in_array($user->role, ['creator', 'vendor'], true);

        foreach ($activeBadges as $badge) {
            $criteria = $badge->criteria ?? [];
            $metric = $criteria['metric'] ?? '';
            $target = (int) ($criteria['value'] ?? 0);
            $eligible = false;

            switch ($metric) {
                case 'followers':
                    $eligible = $followersCount >= $target;
                    break;
                case 'posts':
                    $eligible = $postsCount >= $target;
                    break;
                case 'orders':
                    $eligible = $ordersCount >= $target;
                    break;
                case 'sales':
                    $eligible = $salesCount >= $target;
                    break;
                case 'kyc':
                    $eligible = $isKycVerified;
                    break;
                case 'creator':
                    $eligible = $isCreator;
                    break;
                case 'escrow':
                    $eligible = $hasActiveEscrow;
                    break;
                case 'account_age_days':
                    $eligible = $user->created_at && $user->created_at->diffInDays(now()) >= $target;
                    break;
            }

            if ($eligible) {
                $already = UserBadge::where('user_id', $user->id)->where('badge_id', $badge->id)->exists();
                if (! $already) {
                    UserBadge::create([
                        'user_id' => $user->id,
                        'badge_id' => $badge->id,
                        'earned_at' => now(),
                    ]);
                    $badge->increment('awarded_count');
                }
            }
        }
    }

    public function seed(): JsonResponse
    {
        $defaults = [
            [
                'slug' => 'creator_economy',
                'name' => 'Creator Economy Star',
                'level_label' => 'Master Creator · Level 2',
                'description' => 'Published interactive courses, digital products, and creator assets on MurihSpace.',
                'icon' => 'Star',
                'icon_3d' => '3d-star',
                'color' => '#FF9500',
                'icon_gradient' => 'from-amber-400 via-orange-500 to-amber-600',
                'criteria' => ['metric' => 'creator', 'value' => 1, 'rule' => 'Active creator or vendor account'],
            ],
            [
                'slug' => 'web3_pioneer',
                'name' => 'Web3 Pioneer',
                'level_label' => 'Smart Account · Tier 1',
                'description' => 'Verified smart wallet participant across decentralized governance & Web3 communities.',
                'icon' => 'Wallet',
                'icon_3d' => '3d-cube',
                'color' => '#5856D6',
                'icon_gradient' => 'from-indigo-400 via-purple-600 to-indigo-800',
                'criteria' => ['metric' => 'kyc', 'value' => 1, 'rule' => 'KYC identity verified with wallet link'],
            ],
            [
                'slug' => 'escrow_trusted',
                'name' => 'Escrow Trusted Trader',
                'level_label' => '100% Reliable · Dispute-Free',
                'description' => 'Consistently completes high-trust peer transactions using MurihSpace Escrow Protection.',
                'icon' => 'Shield Done',
                'icon_3d' => '3d-shield',
                'color' => '#34C759',
                'icon_gradient' => 'from-emerald-400 via-green-500 to-teal-600',
                'criteria' => ['metric' => 'escrow', 'value' => 1, 'rule' => 'At least 1 completed dispute-free escrow transaction'],
            ],
            [
                'slug' => 'community_leader',
                'name' => 'Community Champion',
                'level_label' => 'Top 5% Contributor',
                'description' => 'Consistent participant across discussion hubs, mutual spaces, and real-time community rooms.',
                'icon' => '3 User',
                'icon_3d' => '3d-trophy',
                'color' => '#1A68D4',
                'icon_gradient' => 'from-blue-400 via-sky-500 to-blue-700',
                'criteria' => ['metric' => 'followers', 'value' => 20, 'rule' => 'Reached 20+ followers and community connections'],
            ],
            [
                'slug' => 'early_adopter',
                'name' => 'Genesis Member',
                'level_label' => 'Early Adopter',
                'description' => 'Joined during the foundational genesis period and helped establish the ecosystem.',
                'icon' => 'Ticket Star',
                'icon_3d' => '3d-gem',
                'color' => '#FF2D55',
                'icon_gradient' => 'from-pink-400 via-rose-500 to-red-600',
                'criteria' => ['metric' => 'account_age_days', 'value' => 30, 'rule' => 'Registered pioneer member for at least 30 days'],
            ],
            [
                'slug' => 'viral_publisher',
                'name' => 'Content Maestro',
                'level_label' => 'Top Storyteller',
                'description' => 'Published 10 or more viral posts, articles, and short reels across MurihSpace.',
                'icon' => 'Video',
                'icon_3d' => '3d-badge',
                'color' => '#8B5CF6',
                'icon_gradient' => 'from-violet-400 via-purple-500 to-fuchsia-600',
                'criteria' => ['metric' => 'posts', 'value' => 10, 'rule' => 'Published 10 or more posts or reels'],
            ],
            [
                'slug' => 'top_vendor',
                'name' => 'Master Merchant',
                'level_label' => 'Gold Merchant',
                'description' => 'Successfully closed 5 or more digital or physical storefront purchases.',
                'icon' => 'Bag',
                'icon_3d' => '3d-award',
                'color' => '#EAB308',
                'icon_gradient' => 'from-yellow-300 via-amber-500 to-orange-600',
                'criteria' => ['metric' => 'sales', 'value' => 5, 'rule' => 'Completed 5 storefront sales'],
            ],
        ];

        $created = 0;
        foreach ($defaults as $badgeData) {
            Badge::updateOrCreate(['slug' => $badgeData['slug']], $badgeData);
            $created++;
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully seeded {$created} 3D activity badges with automated evaluation rules.",
        ]);
    }
}
