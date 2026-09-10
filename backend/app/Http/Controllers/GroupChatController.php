<?php

namespace App\Http\Controllers;

use App\Events\MessageSent;
use App\Events\TypingIndicator;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Group;
use App\Models\Media;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GroupChatController extends Controller
{
    /**
     * Get or create group conversation.
     */
    public function conversation(Request $request, Group $group): JsonResponse
    {
        $user = $request->user();

        if (!$group->isMember($user->id)) {
            return response()->json(['error' => 'You must be a member to access the group chat.'], 403);
        }

        $conversation = Conversation::firstOrCreate(
            ['type' => 'group', 'group_id' => $group->id],
            ['title' => $group->name]
        );

        ConversationParticipant::firstOrCreate(
            ['conversation_id' => $conversation->id, 'user_id' => $user->id],
            ['last_read_at' => now()]
        );

        return response()->json([
            'success' => true,
            'data' => $conversation,
        ]);
    }

    /**
     * Get message history for group chat.
     */
    public function messages(Request $request, Group $group): JsonResponse
    {
        $user = $request->user();

        if (!$group->isMember($user->id)) {
            return response()->json(['error' => 'You must be a member to access the group chat.'], 403);
        }

        $conversation = Conversation::firstOrCreate(
            ['type' => 'group', 'group_id' => $group->id],
            ['title' => $group->name]
        );

        // Update reader's last_read_at
        ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->update(['last_read_at' => now()]);

        $messages = Message::where('conversation_id', $conversation->id)
            ->visible()
            ->with([
                'user:id,name,username,avatar',
                'replyTo:id,user_id,content,attachment_type',
                'replyTo.user:id,name,username',
                'reactions',
            ])
            ->orderBy('created_at', 'asc')
            ->paginate(50);

        return response()->json([
            'success' => true,
            'conversation_id' => $conversation->id,
            'data' => $messages,
            'messages' => $messages->items(),
        ]);
    }

    /**
     * Send a message to the group chat in real-time.
     */
    public function sendMessage(Request $request, Group $group): JsonResponse
    {
        $user = $request->user();

        if (!$group->canChat($user->id)) {
            return response()->json([
                'error' => 'You do not have permission to chat in this group, or you may be temporarily muted.',
            ], 403);
        }

        $validated = $request->validate([
            'content' => 'required_without_any:attachment_url,media_id|nullable|string|max:5000',
            'attachment_url' => 'nullable|url|max:500',
            'attachment_type' => 'nullable|string|in:image,video,audio,file',
            'media_id' => 'nullable|exists:media,id',
            'reply_to_id' => 'nullable|exists:messages,id',
            'client_uuid' => 'nullable|string|max:64',
        ]);

        $conversation = Conversation::firstOrCreate(
            ['type' => 'group', 'group_id' => $group->id],
            ['title' => $group->name]
        );

        $clientUuid = $validated['client_uuid'] ?? null;
        if ($clientUuid) {
            $existing = Message::where('client_uuid', $clientUuid)->first();
            if ($existing) {
                return response()->json([
                    'data' => $existing->load('user:id,name,username,avatar'),
                ]);
            }
        }

        $message = DB::transaction(function () use ($conversation, $user, $validated, $clientUuid) {
            $attachmentType = $validated['attachment_type'] ?? null;
            $messageType = $attachmentType ?? 'text';

            $mediaStatus = null;
            if (!empty($validated['media_id'])) {
                $media = Media::find($validated['media_id']);
                $mediaStatus = $media ? Message::MEDIA_STATUS_READY : Message::MEDIA_STATUS_FAILED;
                $media?->incrementReferenceCount();
            }

            $msg = Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'content' => trim($validated['content'] ?? ''),
                'type' => $messageType,
                'status' => Message::STATUS_SENT,
                'client_uuid' => $clientUuid,
                'reply_to_id' => $validated['reply_to_id'] ?? null,
                'attachment_url' => $validated['attachment_url'] ?? null,
                'attachment_type' => $attachmentType,
                'media_id' => $validated['media_id'] ?? null,
                'media_status' => $mediaStatus,
            ]);

            $conversation->touch();

            ConversationParticipant::where('conversation_id', $conversation->id)
                ->where('user_id', $user->id)
                ->update(['last_read_at' => now()]);

            return $msg;
        });

        $loadedMessage = $message->load([
            'user:id,name,username,avatar',
            'replyTo:id,user_id,content,attachment_type',
            'replyTo.user:id,name,username',
        ]);

        // Broadcast MessageSent over WebSocket
        event(new MessageSent($loadedMessage));

        return response()->json([
            'success' => true,
            'data' => $loadedMessage,
        ], 201);
    }
}
