<?php

namespace App\Http\Controllers;

use App\Events\MessageReacted;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\MessageReaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MessageReactionController extends Controller
{
    private function assertAccess(int $messageId, int $userId): Message
    {
        $message = Message::findOrFail($messageId);
        $isParticipant = ConversationParticipant::where('conversation_id', $message->conversation_id)
            ->where('user_id', $userId)
            ->exists();

        if (! $isParticipant) {
            abort(403, 'You are not a participant in this conversation.');
        }

        return $message;
    }

    public function toggle(Request $request, int $messageId): JsonResponse
    {
        $validated = $request->validate([
            'emoji' => ['required', 'string', 'max:12'],
        ]);

        $message = $this->assertAccess($messageId, $request->user()->id);

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
                'user_id' => $request->user()->id,
                'emoji' => $validated['emoji'],
            ]);
            $action = 'added';
        }

        $summary = $this->reactionSummary($message, $request->user()->id);

        broadcast(new MessageReacted($message, $validated['emoji'], $action, $request->user()->id, $summary));

        return response()->json([
            'action' => $action,
            'reactions' => $summary,
        ]);
    }

    public function index(Request $request, int $messageId): JsonResponse
    {
        $message = $this->assertAccess($messageId, $request->user()->id);
        $summary = $this->reactionSummary($message, $request->user()->id);

        return response()->json(['data' => $summary]);
    }

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
