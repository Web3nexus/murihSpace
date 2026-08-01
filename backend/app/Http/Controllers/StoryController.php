<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
use App\Models\Story;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $stories = Story::with(['user:id,name,username,avatar'])
            ->active()
            ->orderBy('created_at', 'desc')
            ->get()
            ->groupBy('user_id')
            ->map(function ($items) {
                $user = $items->first()->user;
                return [
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'username' => $user->username,
                        'avatar' => $user->avatar,
                    ],
                    'stories' => $items->map(fn ($s) => [
                        'id' => $s->id,
                        'media_url' => $s->media_url,
                        'media_type' => $s->media_type,
                        'caption' => $s->caption,
                        'created_at' => $s->created_at,
                        'expires_at' => $s->expires_at,
                    ])->values(),
                ];
            })
            ->values();

        return response()->json($stories->values()->toArray());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'media_url' => ['nullable', 'string', 'url'],
            'media_type' => ['required', Rule::in(['image', 'text', 'video'])],
            'caption' => ['nullable', 'string', 'max:500'],
        ]);

        $settingKey = 'story_type_' . $validated['media_type'] . '_enabled';
        $enabled = AdminSetting::get($settingKey, '1');

        if ($enabled !== '1') {
            $label = ucfirst($validated['media_type']);
            return response()->json([
                'message' => "{$label} stories are currently disabled by the platform administrator.",
            ], 403);
        }

        $story = Story::create([
            'user_id' => $request->user()->id,
            'media_url' => $validated['media_url'] ?? null,
            'media_type' => $validated['media_type'],
            'caption' => $validated['caption'] ?? null,
            'expires_at' => now()->addHours(24),
        ]);

        $story->load('user:id,name,username,avatar');

        return response()->json($story->toArray(), 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $story = Story::findOrFail($id);

        if ($story->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $story->delete();

        return response()->json(['message' => 'Story deleted.']);
    }
}
