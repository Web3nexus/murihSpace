<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatSettingsController extends Controller
{
    /**
     * Get current user's chat preferences.
     */
    public function show(Request $request): JsonResponse
    {
        $user = $request->user();

        // Also touch last_seen_at
        $user->forceFill(['last_seen_at' => now()])->saveQuietly();

        return response()->json([
            'data' => [
                'show_online_status' => (bool) ($user->show_online_status ?? true),
                'read_receipts_enabled' => (bool) ($user->read_receipts_enabled ?? true),
                'chat_sounds_enabled' => (bool) ($user->chat_sounds_enabled ?? true),
                'greeting_message_enabled' => (bool) ($user->greeting_message_enabled ?? false),
                'greeting_message' => $user->greeting_message,
                'away_message_enabled' => (bool) ($user->away_message_enabled ?? false),
                'away_message' => $user->away_message,
                'is_online' => $user->isOnline(),
            ],
        ]);
    }

    /**
     * Update current user's chat preferences.
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'show_online_status' => ['sometimes', 'boolean'],
            'read_receipts_enabled' => ['sometimes', 'boolean'],
            'chat_sounds_enabled' => ['sometimes', 'boolean'],
            'greeting_message_enabled' => ['sometimes', 'boolean'],
            'greeting_message' => ['nullable', 'string', 'max:1000'],
            'away_message_enabled' => ['sometimes', 'boolean'],
            'away_message' => ['nullable', 'string', 'max:1000'],
        ]);

        $user = $request->user();
        $user->fill($validated);
        $user->last_seen_at = now();
        $user->save();

        // Also sync with storefront if exists
        if (array_key_exists('greeting_message_enabled', $validated) || array_key_exists('greeting_message', $validated)) {
            \App\Models\Storefront::where('user_id', $user->id)->update(array_filter([
                'greeting_message_enabled' => $validated['greeting_message_enabled'] ?? null,
                'greeting_message' => $validated['greeting_message'] ?? null,
            ], fn($v) => !is_null($v)));
        }

        return response()->json([
            'message' => 'Chat settings updated.',
            'data' => [
                'show_online_status' => (bool) $user->show_online_status,
                'read_receipts_enabled' => (bool) $user->read_receipts_enabled,
                'chat_sounds_enabled' => (bool) $user->chat_sounds_enabled,
                'greeting_message_enabled' => (bool) $user->greeting_message_enabled,
                'greeting_message' => $user->greeting_message,
                'away_message_enabled' => (bool) $user->away_message_enabled,
                'away_message' => $user->away_message,
                'is_online' => $user->isOnline(),
            ],
        ]);
    }

    /**
     * Ping / heartbeat to update user's online presence.
     */
    public function heartbeat(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user) {
            $user->forceFill(['last_seen_at' => now()])->saveQuietly();
        }

        return response()->json([
            'ok' => true,
            'is_online' => $user ? $user->isOnline() : false,
        ]);
    }
}
