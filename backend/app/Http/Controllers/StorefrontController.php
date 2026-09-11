<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\Storefront;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class StorefrontController extends Controller
{
    /**
     * Get authenticated creator's storefront (boots default if missing).
     */
    public function mine(Request $request): JsonResponse
    {
        $user = $request->user();

        $store = Storefront::firstOrCreate(
            ['user_id' => $user->id],
            [
                'display_name' => $user->name,
                'tagline' => 'Welcome to my official creator storefront.',
                'bio' => 'Explore my digital products, community memberships, and exclusive content.',
                'short_code' => Str::slug($user->username ?? $user->name ?? "user-{$user->id}"),
                'is_published' => false,
                'links' => [],
            ]
        );

        return response()->json(['data' => $store]);
    }

    /**
     * Update authenticated creator's storefront settings.
     */
    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $store = Storefront::where('user_id', $user->id)->firstOrFail();

        $this->authorize('update', $store);

        $validated = $request->validate([
            'display_name' => ['required', 'string', 'max:100'],
            'tagline' => ['nullable', 'string', 'max:255'],
            'bio' => ['nullable', 'string', 'max:2000'],
            'cover_url' => ['nullable', 'string', 'max:2000'],
            'avatar_url' => ['nullable', 'string', 'max:2000'],
            'short_code' => ['required', 'string', 'alpha_dash', 'max:50', "unique:storefronts,short_code,{$store->id}"],
            'links' => ['nullable', 'array', 'max:10'],
            'links.*.label' => ['required_with:links', 'string', 'max:50'],
            'links.*.url' => ['required_with:links', 'string', 'url', 'max:500'],
        ]);

        $store->update($validated);

        return response()->json([
            'message' => 'Storefront updated successfully.',
            'data' => $store->fresh(),
        ]);
    }

    /**
     * Toggle storefront publish state.
     */
    public function publish(Request $request): JsonResponse
    {
        $user = $request->user();
        $store = Storefront::where('user_id', $user->id)->firstOrFail();

        $this->authorize('publish', $store);

        $validated = $request->validate([
            'is_published' => ['required', 'boolean'],
        ]);

        $store->update(['is_published' => $validated['is_published']]);

        $statusText = $store->is_published ? 'published' : 'unpublished';

        return response()->json([
            'message' => "Storefront is now {$statusText}.",
            'data' => $store,
        ]);
    }

    /**
     * Public endpoint: fetch a creator's public storefront by short code or username.
     * Supports previewing drafts for the authenticated store owner.
     */
    public function show(Request $request, string $shortCode): JsonResponse
    {
        $authUser = auth('sanctum')->user() ?? $request->user();

        $store = Storefront::where('short_code', $shortCode)->first();

        if (! $store) {
            // Fallback: try matching username
            $user = User::where('username', $shortCode)->first();
            if ($user) {
                $store = Storefront::where('user_id', $user->id)->first();
            }
        }

        if (! $store) {
            return response()->json(['message' => 'Storefront not found.'], 404);
        }

        $isOwnerOrAdmin = $authUser && ($authUser->id === $store->user_id || $authUser->isAdmin());

        if (! $store->is_published && ! $isOwnerOrAdmin) {
            return response()->json(['message' => 'This storefront is currently unpublished or offline.'], 404);
        }

        $creator = User::find($store->user_id);

        // Fetch creator's public communities
        $communities = Community::where('creator_id', $store->user_id)
            ->where('is_private', false)
            ->select('id', 'name', 'slug', 'description', 'members_count')
            ->get();

        // Fetch creator/vendor active products
        $physicalProducts = \App\Models\PhysicalProduct::where('creator_id', $store->user_id)
            ->active()
            ->latest()
            ->take(12)
            ->get(['id', 'title', 'description', 'sku', 'price', 'currency', 'category', 'images', 'stock_quantity']);

        $digitalProducts = \App\Models\DigitalProduct::where('creator_id', $store->user_id)
            ->where('status', 'published')
            ->latest()
            ->take(12)
            ->get(['id', 'title', 'description', 'price', 'currency', 'category', 'cover_url']);

        return response()->json([
            'data' => [
                'id' => $store->id,
                'display_name' => $store->display_name,
                'tagline' => $store->tagline,
                'bio' => $store->bio,
                'cover_url' => $store->cover_url,
                'avatar_url' => $store->avatar_url ?? $creator?->avatar_url,
                'short_code' => $store->short_code,
                'is_published' => (bool) $store->is_published,
                'is_preview' => ! $store->is_published || $request->boolean('preview'),
                'is_owner' => (bool) ($authUser && $authUser->id === $store->user_id),
                'links' => $store->links ?? [],
                'creator' => [
                    'id' => $creator?->id,
                    'name' => $creator?->name,
                    'username' => $creator?->username,
                    'avatar' => $creator?->avatar,
                    'avatar_url' => $creator?->avatar_url,
                    'role' => $creator?->role,
                    'is_verified' => $creator?->has_active_verification_badge ?? false,
                ],
                'communities' => $communities,
                'physical_products' => $physicalProducts,
                'digital_products' => $digitalProducts,
            ],
        ]);
    }
}
