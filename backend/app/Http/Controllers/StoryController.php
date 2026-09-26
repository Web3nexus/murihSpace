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
        $currentUserId = $request->user('sanctum')?->id ?? $request->user()?->id;

        $stories = Story::with(['user:id,name,username,avatar'])
            ->active()
            ->orderBy('created_at', 'desc')
            ->get()
            ->groupBy('user_id')
            ->map(function ($items) use ($currentUserId) {
                $user = $items->first()->user;
                if (!$user) return null;

                $avatar = $user->avatar;
                if ($avatar && !str_starts_with($avatar, 'http')) {
                    $avatar = url(str_starts_with($avatar, '/') ? $avatar : '/storage/' . ltrim($avatar, '/'));
                }

                $storyItems = $items->map(function ($s) {
                    $media = $s->media_url;
                    if ($media && !str_starts_with($media, 'http')) {
                        $media = url(str_starts_with($media, '/') ? $media : '/storage/' . ltrim($media, '/'));
                    }
                    return [
                        'id' => (string) $s->id,
                        'media_url' => $media,
                        'media_type' => $s->media_type ?? 'image',
                        'caption' => $s->caption,
                        'created_at' => $s->created_at?->toIso8601String(),
                        'expires_at' => $s->expires_at?->toIso8601String(),
                    ];
                })->values();

                return [
                    'user_id' => (string) $user->id,
                    'user_name' => $user->name,
                    'user_avatar' => $avatar,
                    'is_my_story' => $currentUserId && $user->id === $currentUserId,
                    'user' => [
                        'id' => $user->id,
                        'name' => $user->name,
                        'username' => $user->username,
                        'avatar' => $avatar,
                        'avatar_url' => $avatar,
                        'is_online' => $user->isOnline(),
                        'last_seen' => $user->lastSeenForHuman(),
                    ],
                    'stories' => $storyItems,
                ];
            })
            ->filter()
            ->values();

        return response()->json($stories->values()->toArray());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'media_url' => ['nullable', 'string', 'max:2048'],
            'media_type' => ['nullable', Rule::in(['image', 'text', 'video'])],
            'caption' => ['nullable', 'string', 'max:500'],
        ]);

        $mediaType = $validated['media_type'] ?? 'image';
        $settingKey = 'story_type_' . $mediaType . '_enabled';
        $enabled = AdminSetting::get($settingKey, '1');

        if ($enabled !== '1') {
            $label = ucfirst($mediaType);
            return response()->json([
                'message' => "{$label} stories are currently disabled by the platform administrator.",
            ], 403);
        }

        $story = Story::create([
            'user_id' => $request->user()->id,
            'media_url' => $validated['media_url'] ?? null,
            'media_type' => $mediaType,
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
