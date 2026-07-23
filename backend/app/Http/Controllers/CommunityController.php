<?php

namespace App\Http\Controllers;

use App\Models\Community;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class CommunityController extends Controller
{
    /**
     * Display a public list of communities for Discovery.
     */
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

        return response()->json($communities);
    }

    /**
     * Show a public preview of a single community by slug.
     */
    public function show(string $slug): JsonResponse
    {
        $community = Community::with('creator:id,name,username,avatar')
            ->where('slug', $slug)
            ->first();

        if (!$community) {
            return response()->json([
                'message' => 'Community not found.',
            ], 404);
        }

        return response()->json([
            'community' => $community,
        ]);
    }

    /**
     * Store a newly created community (Authenticated Creator).
     */
    public function store(Request $request): JsonResponse
    {
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

        // Auto-generate slug
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
            'members_count' => 1, // Creator is the first member
        ]);

        $community->load('creator:id,name,username,avatar');

        return response()->json([
            'message' => 'Community created successfully.',
            'community' => $community,
        ], 201);
    }

    /**
     * Get communities owned/created by the current user.
     */
    public function myCommunities(Request $request): JsonResponse
    {
        $communities = Community::where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json([
            'communities' => $communities,
        ]);
    }
}
