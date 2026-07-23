<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\ConversationUserSetting;
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
            'is_muted'    => ['sometimes', 'boolean'],
            'is_archived' => ['sometimes', 'boolean'],
        ]);

        $settings = ConversationUserSetting::firstOrCreate([
            'conversation_id' => $conversation->id,
            'user_id'         => $request->user()->id,
        ]);

        $settings->fill($validated)->save();

        return response()->json([
            'message'  => 'Conversation settings updated.',
            'data'     => $settings,
        ]);
    }

    /**
     * Get the authenticated user's settings for a conversation.
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $settings = ConversationUserSetting::firstOrCreate([
            'conversation_id' => $id,
            'user_id'         => $request->user()->id,
        ], ['is_muted' => false, 'is_archived' => false]);

        return response()->json(['data' => $settings]);
    }
}
