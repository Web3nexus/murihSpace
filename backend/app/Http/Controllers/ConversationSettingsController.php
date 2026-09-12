<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\ConversationUserSetting;
use App\Models\AdminSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationSettingsController extends Controller
{
    /**
     * Update mute / archive settings for the authenticated user on a conversation.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $conversation = Conversation::findOrFail($id);

        // Ensure participant access
        $isParticipant = ConversationParticipant::where('conversation_id', $id)
            ->where('user_id', $request->user()->id)
            ->exists();

        if (! $isParticipant) {
            return response()->json(['message' => 'You are not a participant in this conversation.'], 403);
        }

        $validated = $request->validate([
            'is_muted' => ['sometimes', 'boolean'],
            'is_archived' => ['sometimes', 'boolean'],
            'is_pinned' => ['sometimes', 'boolean'],
        ]);

        $settings = ConversationUserSetting::firstOrCreate([
            'conversation_id' => $conversation->id,
            'user_id' => $request->user()->id,
        ]);

        if (array_key_exists('is_pinned', $validated)) {
            $maxPinned = (int) AdminSetting::get('max_pinned_chats', 3);

            if ($validated['is_pinned'] && ! $settings->pinned_at) {
                $currentPinned = ConversationUserSetting::where('user_id', $request->user()->id)
                    ->whereNotNull('pinned_at')
                    ->count();

                if ($currentPinned >= $maxPinned) {
                    return response()->json([
                        'message' => "Pin limit reached. You can pin up to {$maxPinned} chats.",
                    ], 422);
                }
                $settings->pinned_at = now();
            } elseif (! $validated['is_pinned']) {
                $settings->pinned_at = null;
            }
        }

        $settings->fill($validated)->save();

        return response()->json([
            'message' => 'Conversation settings updated.',
            'data' => $settings,
        ]);
    }

    /**
     * Get the authenticated user's settings for a conversation.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $settings = ConversationUserSetting::firstOrCreate([
            'conversation_id' => $id,
            'user_id' => $request->user()->id,
        ], ['is_muted' => false, 'is_archived' => false]);

        $settings->is_pinned = (bool) $settings->pinned_at;

        return response()->json(['data' => $settings]);
    }
}
