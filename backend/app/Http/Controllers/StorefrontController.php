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
     */
    public function show(string $shortCode): JsonResponse
    {
        $store = Storefront::where('short_code', $shortCode)
            ->where('is_published', true)
            ->first();

        if (! $store) {
            // Fallback: try matching username
            $user = User::where('username', $shortCode)->first();
            if ($user) {
                $store = Storefront::where('user_id', $user->id)
                    ->where('is_published', true)
                    ->first();
            }
        }

        if (! $store) {
            return response()->json(['message' => 'Public storefront not found or unpublished.'], 404);
        }

        $creator = User::find($store->user_id);

        // Fetch creator's public communities
        $communities = Community::where('creator_id', $store->user_id)
            ->where('is_private', false)
            ->select('id', 'name', 'slug', 'description', 'members_count')
            ->get();

        return response()->json([
            'data' => [
                'display_name' => $store->display_name,
                'tagline' => $store->tagline,
                'bio' => $store->bio,
                'cover_url' => $store->cover_url,
                'avatar_url' => $store->avatar_url ?? $creator?->avatar_url,
                'short_code' => $store->short_code,
                'links' => $store->links ?? [],
                'creator' => [
                    'name' => $creator?->name,
                    'username' => $creator?->username,
                ],
                'communities' => $communities,
            ],
        ]);
    }
}
