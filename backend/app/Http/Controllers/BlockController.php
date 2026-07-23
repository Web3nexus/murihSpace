<?php

namespace App\Http\Controllers;

use App\Models\UserBlock;
use App\Models\UserMute;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BlockController extends Controller
{
    /**
     * Block a user.
     */
    public function block(Request $request, int $userId): JsonResponse
    {
        if ($userId === $request->user()->id) {
            return response()->json(['message' => 'You cannot block yourself.'], 422);
        }

        $user = User::findOrFail($userId);

        UserBlock::firstOrCreate([
            'blocker_id' => $request->user()->id,
            'blocked_id' => $user->id,
        ]);

        return response()->json(['message' => "You have blocked {$user->name}."]);
    }

    /**
     * Unblock a user.
     */
    public function unblock(Request $request, int $userId): JsonResponse
    {
        UserBlock::where('blocker_id', $request->user()->id)
            ->where('blocked_id', $userId)
            ->delete();

        return response()->json(['message' => 'User unblocked.']);
    }

    /**
     * Mute a user (suppress content without blocking).
     */
    public function mute(Request $request, int $userId): JsonResponse
    {
        if ($userId === $request->user()->id) {
            return response()->json(['message' => 'You cannot mute yourself.'], 422);
        }

        $user = User::findOrFail($userId);

        UserMute::firstOrCreate([
            'muter_id' => $request->user()->id,
            'muted_id' => $user->id,
        ]);

        return response()->json(['message' => "{$user->name} has been muted."]);
    }

    /**
     * Unmute a user.
     */
    public function unmute(Request $request, int $userId): JsonResponse
    {
        UserMute::where('muter_id', $request->user()->id)
            ->where('muted_id', $userId)
            ->delete();

        return response()->json(['message' => 'User unmuted.']);
    }

    /**
     * Get list of users blocked by the authenticated user.
     */
    public function blocked(Request $request): JsonResponse
    {
        $blocks = UserBlock::where('blocker_id', $request->user()->id)
            ->with('blocked:id,name,username')
            ->latest()
            ->get()
            ->pluck('blocked');

        return response()->json(['data' => $blocks]);
    }

    /**
     * Get list of users muted by the authenticated user.
     */
    public function muted(Request $request): JsonResponse
    {
        $mutes = UserMute::where('muter_id', $request->user()->id)
            ->with('muted:id,name,username')
            ->latest()
            ->get()
            ->pluck('muted');

        return response()->json(['data' => $mutes]);
    }
}
