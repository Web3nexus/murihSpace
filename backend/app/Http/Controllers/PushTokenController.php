<?php

namespace App\Http\Controllers;

use App\Models\PushToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PushTokenController extends Controller
{
    /**
     * Register a push notification token.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token'    => ['required', 'string'],
            'platform' => ['required', Rule::in(PushToken::PLATFORMS)],
        ]);

        // Upsert — same token for same user updates platform
        PushToken::updateOrCreate(
            ['user_id' => $request->user()->id, 'token' => $validated['token']],
            ['platform' => $validated['platform']],
        );

        return response()->json(['message' => 'Push token registered.']);
    }

    /**
     * Remove a push notification token (on logout or permission revoked).
     */
    public function destroy(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
        ]);

        PushToken::where('user_id', $request->user()->id)
            ->where('token', $validated['token'])
            ->delete();

        return response()->json(['message' => 'Push token removed.']);
    }
}
