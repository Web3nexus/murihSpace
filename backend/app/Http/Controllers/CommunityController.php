<?php

namespace App\Http\Controllers;

use App\Models\Community;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CommunityController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $category = $request->query('category');

        $query = Community::with('creator:id,name,username,avatar')
            ->publicOnly()
            ->byCategory($category);

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $communities = $query->latest()->paginate(12);

        return response()->json([
            'success' => true,
            'data' => $communities,
            'communities' => $communities->items(),
        ]);
    }

    /**
     * Public community discovery — no authentication required.
     * Only returns public communities for the marketing/landing page.
     */
    public function publicIndex(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $category = $request->query('category');

        $query = Community::with('creator:id,name,username,avatar')
            ->publicOnly()
            ->withCount(['memberships as member_count' => fn ($q) => $q->where('status', 'active')]);

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($category) {
            $query->where('category', $category);
        }

        $communities = $query->latest()->paginate(18);

        return response()->json([
            'success' => true,
            'data' => $communities,
        ]);
    }

    public function show(string $slug): JsonResponse
    {
        $community = Community::with('creator:id,name,username,avatar')
            ->withCount(['memberships as active_members_count' => fn ($q) => $q->where('status', 'active')])
            ->where('slug', $slug)
            ->first();

        if (! $community) {
            return response()->json(['message' => 'Community not found.'], 404);
        }

        return response()->json([
            'community' => $community,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorize('create', Community::class);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'category' => ['required', 'string', 'max:50'],
            'visibility' => ['required', Rule::in(['public', 'private'])],
            'pricing_type' => ['required', Rule::in(['free', 'paid'])],
            'price_amount' => ['nullable', 'numeric', 'min:0'],
            'logo_url' => ['nullable', 'string', 'max:500'],
            'cover_url' => ['nullable', 'string', 'max:500'],
            'rules' => ['nullable', 'array'],
            'rules.*' => ['string', 'max:255'],
        ]);

        $baseSlug = Str::slug($validated['name']);
        $slug = $baseSlug;
        $counter = 1;

        while (Community::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$counter}";
            $counter++;
        }

        $community = Community::create([
            'user_id' => $request->user()->id,
            'name' => $validated['name'],
            'slug' => $slug,
            'description' => $validated['description'] ?? null,
            'category' => $validated['category'],
            'visibility' => $validated['visibility'],
            'pricing_type' => $validated['pricing_type'],
            'price_amount' => $validated['pricing_type'] === 'paid' ? ($validated['price_amount'] ?? 0) : null,
            'logo_url' => $validated['logo_url'] ?? null,
            'cover_url' => $validated['cover_url'] ?? null,
            'rules' => $validated['rules'] ?? [
                'Be respectful to all community members.',
                'No spam, self-promotion or unauthorized links.',
                'Engage constructively and share valuable knowledge.',
            ],
            'members_count' => 1,
        ]);

        $community->load('creator:id,name,username,avatar');

        return response()->json([
            'message' => 'Community created successfully.',
            'community' => $community,
        ], 201);
    }

    public function myCommunities(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['success' => true, 'communities' => [], 'data' => []]);
        }

        $created = Community::where('user_id', $user->id)
            ->latest()
            ->get();

        $joined = Community::whereIn('id', function ($q) use ($user) {
            $q->select('community_id')
                ->from('community_memberships')
                ->where('user_id', $user->id)
                ->where('status', 'active');
        })->latest()->get();

        $all = $created->merge($joined)->unique('id')->values()->sortByDesc('created_at')->values();

        return response()->json([
            'success' => true,
            'communities' => $all,
            'data' => $all,
        ]);
    }

    public function update(Request $request, Community $community): JsonResponse
    {
        $this->authorize('update', $community);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
            'category' => ['sometimes', 'string', 'max:50'],
            'visibility' => ['sometimes', Rule::in(['public', 'private'])],
            'pricing_type' => ['sometimes', Rule::in(['free', 'paid'])],
            'price_amount' => ['nullable', 'numeric', 'min:0'],
            'logo_url' => ['nullable', 'string', 'max:500'],
            'cover_url' => ['nullable', 'string', 'max:500'],
            'rules' => ['nullable', 'array'],
            'rules.*' => ['string', 'max:255'],
        ]);

        if (isset($validated['name']) && $validated['name'] !== $community->name) {
            $baseSlug = Str::slug($validated['name']);
            $slug = $baseSlug;
            $counter = 1;
            while (Community::where('slug', $slug)->where('id', '!=', $community->id)->exists()) {
                $slug = "{$baseSlug}-{$counter}";
                $counter++;
            }
            $validated['slug'] = $slug;
        }

        $effectiveType = $validated['pricing_type'] ?? $community->pricing_type;
        if (isset($validated['price_amount'])) {
            $validated['price_amount'] = $validated['pricing_type'] === 'paid'
                ? ($validated['price_amount'] ?? $community->price_amount ?? 0)
                : null;
        } elseif ($validated['pricing_type'] ?? null) {
            $validated['price_amount'] = $validated['pricing_type'] === 'paid' ? ($community->price_amount ?? 0) : null;
        }

        $community->update($validated);

        return response()->json([
            'message' => 'Community updated.',
            'community' => $community->fresh()->load('creator:id,name,username,avatar'),
        ]);
    }

    public function destroy(Request $request, Community $community): JsonResponse
    {
        $this->authorize('delete', $community);

        if ($community->trashed()) {
            $community->memberships()->delete();
            $community->forceDelete();
        } else {
            $community->delete();
        }

        return response()->json(['message' => 'Community deleted.']);
    }

    // ── Admin endpoints ─────────────────────────────────────────────

    public function adminIndex(Request $request): JsonResponse
    {
        $search = $request->query('search');
        $visibility = $request->query('visibility');
        $category = $request->query('category');
        $sort = $request->query('sort', 'latest');

        $query = Community::with('creator:id,name,username,avatar');

        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }
        if ($visibility) $query->where('visibility', $visibility);
        if ($category) $query->where('category', $category);
        if ($sort === 'oldest') $query->oldest();
        else $query->latest();

        $communities = $query->withCount(['memberships', 'memberships as active_members_count' => fn ($q) => $q->where('status', 'active')])
            ->paginate(20);

        $stats = [
            'total' => Community::count(),
            'public' => Community::where('visibility', 'public')->count(),
            'private' => Community::where('visibility', 'private')->count(),
            'categories' => Community::selectRaw('category, count(*) as count')
                ->groupBy('category')->orderByDesc('count')->get(),
        ];

        return response()->json(['data' => $communities, 'stats' => $stats]);
    }

    public function adminShow(int $id): JsonResponse
    {
        $community = Community::with([
            'creator:id,name,username,email,avatar,role',
            'memberships' => fn ($q) => $q->with('user:id,name,username,email')->latest()->limit(50),
        ])->withCount(['memberships', 'memberships as active_members_count' => fn ($q) => $q->where('status', 'active')])
            ->findOrFail($id);

        return response()->json(['data' => $community]);
    }

    public function adminDelete(int $id): JsonResponse
    {
        $community = Community::findOrFail($id);
        $community->memberships()->delete();
        $community->delete();

        return response()->json(['message' => 'Community deleted.']);
    }
}
