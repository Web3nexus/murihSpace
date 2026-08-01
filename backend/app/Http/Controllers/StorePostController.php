<?php

namespace App\Http\Controllers;

use App\Models\StorePost;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StorePostController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $posts = StorePost::where('creator_id', $request->user()->id)
            ->orderBy('sort_order')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $posts]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'content' => ['required', 'string', 'max:5000'],
            'font_family' => ['nullable', 'string', 'max:50'],
            'background_color' => ['nullable', 'string', 'max:20'],
            'text_color' => ['nullable', 'string', 'max:20'],
            'text_align' => ['nullable', 'string', 'max:20'],
            'is_published' => ['nullable', 'boolean'],
        ]);

        $maxSort = StorePost::where('creator_id', $request->user()->id)->max('sort_order') ?? 0;

        $post = StorePost::create([
            'creator_id' => $request->user()->id,
            'content' => $validated['content'],
            'font_family' => $validated['font_family'] ?? 'sans',
            'background_color' => $validated['background_color'] ?? '#1a1a2e',
            'text_color' => $validated['text_color'] ?? '#ffffff',
            'text_align' => $validated['text_align'] ?? 'center',
            'is_published' => $validated['is_published'] ?? true,
            'sort_order' => $maxSort + 1,
        ]);

        return response()->json(['data' => $post], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $post = StorePost::where('creator_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'content' => ['sometimes', 'string', 'max:5000'],
            'font_family' => ['nullable', 'string', 'max:50'],
            'background_color' => ['nullable', 'string', 'max:20'],
            'text_color' => ['nullable', 'string', 'max:20'],
            'text_align' => ['nullable', 'string', 'max:20'],
            'is_published' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
        ]);

        $post->update($validated);

        return response()->json(['data' => $post->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $post = StorePost::where('creator_id', $request->user()->id)->findOrFail($id);
        $post->delete();

        return response()->json(['message' => 'Post deleted.']);
    }

    public function publicPosts(string $shortCode): JsonResponse
    {
        $storefront = \App\Models\Storefront::where('short_code', $shortCode)
            ->where('is_published', true)
            ->firstOrFail();

        $posts = StorePost::where('creator_id', $storefront->user_id)
            ->where('is_published', true)
            ->orderBy('sort_order')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json(['data' => $posts]);
    }
}
