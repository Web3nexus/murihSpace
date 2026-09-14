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
        ]);

        $user = $request->user();
        $user->fill($validated);
        $user->last_seen_at = now();
        $user->save();

        return response()->json([
            'message' => 'Chat settings updated.',
            'data' => [
                'show_online_status' => (bool) $user->show_online_status,
                'read_receipts_enabled' => (bool) $user->read_receipts_enabled,
                'chat_sounds_enabled' => (bool) $user->chat_sounds_enabled,
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
