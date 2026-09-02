<?php

namespace App\Http\Controllers;

use App\Models\SoundTrack;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SoundTrackController extends Controller
{
    /**
     * List all active sound tracks (for streamers and audio rooms).
     */
    public function index(Request $request): JsonResponse
    {
        $query = SoundTrack::active();

        if ($request->filled('category') && $request->category !== 'All') {
            $query->where('category', $request->category);
        }

        if ($request->filled('search')) {
            $search = '%' . $request->search . '%';
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', $search)
                  ->orWhere('artist', 'like', $search);
            });
        }

        $sounds = $query->latest()->get();

        return response()->json(['data' => $sounds]);
    }

    /**
     * Admin: List all sound tracks (active and inactive).
     */
    public function adminIndex(Request $request): JsonResponse
    {
        $query = SoundTrack::query();

        if ($request->filled('search')) {
            $search = '%' . $request->search . '%';
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', $search)
                  ->orWhere('artist', 'like', $search);
            });
        }

        $sounds = $query->latest()->paginate(30);

        return response()->json($sounds);
    }

    /**
     * Admin: Store a new sound track.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'artist' => ['nullable', 'string', 'max:255'],
            'audio_url' => ['required', 'string', 'url', 'max:2000'],
            'cover_url' => ['nullable', 'string', 'url', 'max:2000'],
            'duration' => ['nullable', 'integer', 'min:0'],
            'category' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $validated['category'] ??= 'General';
        $validated['is_active'] ??= true;

        $sound = SoundTrack::create($validated);

        return response()->json([
            'message' => 'Sound track added successfully.',
            'data' => $sound,
        ], 201);
    }

    /**
     * Admin: Update sound track.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $sound = SoundTrack::findOrFail($id);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'artist' => ['nullable', 'string', 'max:255'],
            'audio_url' => ['sometimes', 'required', 'string', 'url', 'max:2000'],
            'cover_url' => ['nullable', 'string', 'url', 'max:2000'],
            'duration' => ['nullable', 'integer', 'min:0'],
            'category' => ['nullable', 'string', 'max:100'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $sound->update($validated);

        return response()->json([
            'message' => 'Sound track updated successfully.',
            'data' => $sound,
        ]);
    }

    /**
     * Admin: Delete sound track.
     */
    public function destroy(int $id): JsonResponse
    {
        $sound = SoundTrack::findOrFail($id);
        $sound->delete();

        return response()->json(['message' => 'Sound track deleted.']);
    }
}
