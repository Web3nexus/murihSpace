<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\MessageReaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageReactionController extends Controller
{
    /**
     * Toggle an emoji reaction on a message.
     * If the user already reacted with this emoji, remove it. Otherwise add it.
     */
    public function toggle(Request $request, int $messageId): JsonResponse
    {
        $validated = $request->validate([
            'emoji' => ['required', 'string', 'max:12'],
        ]);

        $message = Message::findOrFail($messageId);

        $existing = MessageReaction::where('message_id', $message->id)
            ->where('user_id', $request->user()->id)
            ->where('emoji', $validated['emoji'])
            ->first();

        if ($existing) {
            $existing->delete();
            $action = 'removed';
        } else {
            MessageReaction::create([
                'message_id' => $message->id,
                'user_id'    => $request->user()->id,
                'emoji'      => $validated['emoji'],
            ]);
            $action = 'added';
        }

        // Return aggregated reaction summary for this message
        $summary = $this->reactionSummary($message, $request->user()->id);

        return response()->json([
            'action'    => $action,
            'reactions' => $summary,
        ]);
    }

    /**
     * Get all reactions for a message, grouped by emoji.
     */
    public function index(Request $request, int $messageId): JsonResponse
    {
        $message = Message::findOrFail($messageId);
        $summary = $this->reactionSummary($message, $request->user()->id);

        return response()->json(['data' => $summary]);
    }

    /**
     * Build a grouped reaction summary [{emoji, count, by_me}].
     */
    private function reactionSummary(Message $message, int $userId): array
    {
        return MessageReaction::where('message_id', $message->id)
            ->get()
            ->groupBy('emoji')
            ->map(function ($group, $emoji) use ($userId) {
                return [
                    'emoji' => $emoji,
                    'count' => $group->count(),
                    'by_me' => $group->contains('user_id', $userId),
                    'users' => $group->take(3)->pluck('user_id')->toArray(),
                ];
            })
            ->values()
            ->toArray();
    }
}
