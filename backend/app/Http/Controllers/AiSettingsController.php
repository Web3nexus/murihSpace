<?php

namespace App\Http\Controllers;

use App\Models\AiSetting;
use App\Services\AiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AiSettingsController extends Controller
{
    public function show(Request $request, AiService $ai): JsonResponse
    {
        $user = $request->user();
        $stored = $user->aiSetting;
        $effective = $ai->behavior($user);
        $defaults = config('services.anthropic.behavior', []);

        return response()->json([
            'data' => [
                'settings' => [
                    'persona' => $stored?->persona,
                    'tone' => $stored?->tone,
                    'keep_on_topic' => $stored?->keep_on_topic,
                    'off_topic_mode' => $stored?->off_topic_mode,
                    'focus_topics' => $stored?->focus_topics ?? [],
                ],
                'effective' => $effective,
                'defaults' => [
                    'persona' => $defaults['persona'] ?? 'Mera',
                    'tone' => $defaults['tone'] ?? null,
                    'keep_on_topic' => $defaults['keep_on_topic'] ?? true,
                    'off_topic_mode' => $defaults['off_topic_mode'] ?? AiSetting::OFF_TOPIC_REDIRECT,
                    'focus_topics' => $defaults['focus_topics'] ?? null,
                ],
                'profile' => [
                    'about' => $user->creatorProfile?->about,
                    'niche' => $user->creatorProfile?->niche,
                    'content_interests' => $user->creatorProfile?->content_interests ?? [],
                ],
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'persona' => ['nullable', 'string', 'max:80'],
            'tone' => ['nullable', 'string', 'max:200'],
            'keep_on_topic' => ['sometimes', 'boolean'],
            'off_topic_mode' => ['sometimes', 'string', 'in:redirect,decline,flexible'],
            'focus_topics' => ['nullable', 'array', 'max:20'],
            'focus_topics.*' => ['string', 'max:80'],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'The given data was invalid.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();

        $data['user_id'] = $user->id;
        $data['persona'] = isset($data['persona']) && $data['persona'] !== '' ? $data['persona'] : null;
        $data['tone'] = isset($data['tone']) && $data['tone'] !== '' ? $data['tone'] : null;
        $data['focus_topics'] = isset($data['focus_topics']) && $data['focus_topics'] ? $data['focus_topics'] : null;

        $user->aiSetting()->updateOrCreate(['user_id' => $user->id], $data);

        $ai = app(AiService::class);

        return response()->json([
            'success' => true,
            'message' => 'AI behavior updated.',
            'data' => [
                'settings' => $user->aiSetting,
                'effective' => $ai->behavior($user),
            ],
        ]);
    }
}
