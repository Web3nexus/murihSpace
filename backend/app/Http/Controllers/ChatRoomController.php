<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatRoomController extends Controller
{
    public function rooms(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $rooms = Conversation::whereHas('participants', fn($q) => $q->where('user_id', $userId))
            ->withCount(['participants as member_count'])
            ->with([
                'lastMessage' => fn($q) => $q->select('id', 'conversation_id', 'content', 'created_at'),
            ])
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'name' => $c->name ?? $c->participants->where('id', '!=', $userId)->pluck('name')->implode(', '),
                'member_count' => $c->member_count,
                'last_message' => $c->lastMessage?->content,
                'last_activity' => $c->lastMessage?->created_at,
                'unread' => $c->unread_count ?? 0,
            ]);

        return response()->json(['data' => $rooms]);
    }

    public function messages(Request $request, Conversation $room): JsonResponse
    {
        $messages = Message::where('conversation_id', $room->id)
            ->with('user:id,name,username')
            ->oldest()
            ->paginate(50);

        return response()->json(['data' => $messages]);
    }

    public function sendMessage(Request $request, Conversation $room): JsonResponse
    {
        $validated = $request->validate([
            'content' => ['required', 'string', 'max:10000'],
        ]);

        $message = Message::create([
            'conversation_id' => $room->id,
            'user_id' => $request->user()->id,
            'content' => $validated['content'],
        ]);

        return response()->json(['data' => $message->load('user:id,name,username')], 201);
    }
}
