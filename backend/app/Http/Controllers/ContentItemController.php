<?php

namespace App\Http\Controllers;

use App\Models\ContentItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ContentItemController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'max:50'],
            'status' => ['sometimes', Rule::in(['draft', 'published'])],
            'content' => ['nullable', 'string'],
            'thumbnail_url' => ['nullable', 'string', 'max:2000'],
        ]);

        $item = ContentItem::create([
            'creator_id' => $request->user()->id,
            'title' => $validated['title'],
            'type' => $validated['type'],
            'status' => $validated['status'] ?? 'draft',
            'content' => $validated['content'] ?? null,
            'thumbnail_url' => $validated['thumbnail_url'] ?? null,
        ]);

        return response()->json(['data' => $item], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $items = ContentItem::where('creator_id', $request->user()->id)
            ->latest()->paginate($request->input('limit', 50));

        return response()->json(['data' => $items]);
    }

    public function update(Request $request, ContentItem $item): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in(['draft', 'published'])],
            'content' => ['nullable', 'string'],
        ]);

        $item->update($validated);

        return response()->json(['data' => $item->fresh()]);
    }

    public function destroy(Request $request, ContentItem $item): JsonResponse
    {
        $item->delete();
        return response()->json(['message' => 'Content deleted.']);
    }
}
