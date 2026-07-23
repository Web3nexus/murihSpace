<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Message;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConversationController extends Controller
{
    /**
     * List all conversations for the authenticated user with latest message and unread count.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $conversations = Conversation::whereHas('participants', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })
        ->with([
            'latestMessage.user:id,name,username,avatar_url',
            'users:id,name,username,avatar_url',
            'community:id,name,slug,logo_url',
            'participants' => function ($q) use ($userId) {
                $q->where('user_id', $userId);
            },
        ])
        ->get()
        ->map(function ($conv) use ($userId) {
            $participant = $conv->participants->first();
            $lastReadAt = $participant ? $participant->last_read_at : null;

            // Unread count: messages in this conversation created after last_read_at not sent by user
            $unreadCount = Message::where('conversation_id', $conv->id)
                ->where('user_id', '!=', $userId)
                ->when($lastReadAt, fn ($q) => $q->where('created_at', '>', $lastReadAt))
                ->count();

            // For direct conversations, resolve recipient user
            $otherUser = null;
            if ($conv->type === 'direct') {
                $otherUser = $conv->users->firstWhere('id', '!=', $userId);
            }

            return [
                'id'             => $conv->id,
                'type'           => $conv->type,
                'title'          => $conv->type === 'direct' ? ($otherUser ? $otherUser->name : 'Direct Message') : ($conv->type === 'saved' ? 'Saved Messages' : ($conv->community ? $conv->community->name : $conv->title)),
                'community'      => $conv->community,
                'other_user'     => $otherUser,
                'latest_message' => $conv->latestMessage,
                'unread_count'   => $unreadCount,
                'updated_at'     => $conv->updated_at,
            ];
        })
        ->sortByDesc('updated_at')
        ->values();

        return response()->json(['data' => $conversations]);
    }

    /**
     * Start or open a direct 1:1 conversation with another user.
     */
    public function startDirect(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $authId = $request->user()->id;
        $targetId = (int) $validated['user_id'];

        if ($authId === $targetId) {
            return response()->json(['message' => 'To make notes to yourself, use Saved Messages.'], 422);
        }

        // Check if either user has blocked the other
        $isBlocked = UserBlock::where(function ($q) use ($authId, $targetId) {
            $q->where('blocker_id', $authId)->where('blocked_id', $targetId);
        })->orWhere(function ($q) use ($authId, $targetId) {
            $q->where('blocker_id', $targetId)->where('blocked_id', $authId);
        })->exists();

        if ($isBlocked) {
            return response()->json(['message' => 'Cannot initiate conversation with this user.'], 403);
        }

        // Find existing direct conversation with exact participants
        $existing = Conversation::where('type', 'direct')
            ->whereHas('participants', function ($q) use ($authId) {
                $q->where('user_id', $authId);
            })
            ->whereHas('participants', function ($q) use ($targetId) {
                $q->where('user_id', $targetId);
            })
            ->first();

        if ($existing) {
            return response()->json(['data' => $existing]);
        }

        // Create new direct conversation
        $conversation = DB::transaction(function () use ($authId, $targetId) {
            $conv = Conversation::create(['type' => 'direct']);
            ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $authId, 'last_read_at' => now()]);
            ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $targetId]);
            return $conv;
        });

        return response()->json(['data' => $conversation], 201);
    }

    /**
     * Get or create community general chat channel.
     */
    public function getCommunityChat(Request $request, int $communityId): JsonResponse
    {
        $community = Community::findOrFail($communityId);

        // Ensure user is a member or owner
        $isMember = CommunityMembership::where('community_id', $communityId)
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['active', 'approved'])
            ->exists();

        if (! $isMember && $community->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Must be a community member to access general chat.'], 403);
        }

        $conv = Conversation::firstOrCreate(
            ['type' => 'community', 'community_id' => $communityId],
            ['title' => "{$community->name} General"]
        );

        // Ensure current user is a participant
        ConversationParticipant::firstOrCreate([
            'conversation_id' => $conv->id,
            'user_id'         => $request->user()->id,
        ]);

        return response()->json(['data' => $conv]);
    }

    /**
     * Get or create Saved Messages conversation.
     */
    public function getSavedMessages(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $conv = Conversation::where('type', 'saved')
            ->whereHas('participants', function ($q) use ($userId) {
                $q->where('user_id', $userId);
            })
            ->first();

        if (! $conv) {
            $conv = DB::transaction(function () use ($userId) {
                $c = Conversation::create(['type' => 'saved', 'title' => 'Saved Messages']);
                ConversationParticipant::create(['conversation_id' => $c->id, 'user_id' => $userId, 'last_read_at' => now()]);
                return $c;
            });
        }

        return response()->json(['data' => $conv]);
    }

    /**
     * Get paginated message history for a conversation.
     */
    public function messages(Request $request, int $id): JsonResponse
    {
        $conversation = Conversation::findOrFail($id);
        $this->authorizeParticipant($request, $conversation);

        $messages = Message::where('conversation_id', $id)
            ->with([
                'user:id,name,username,avatar_url',
                'replyTo:id,user_id,content,attachment_type',
                'replyTo.user:id,name,username',
                'reactions',
            ])
            ->orderBy('created_at', 'asc')
            ->paginate(50);

        return response()->json($messages);
    }

    /**
     * Send a text message to a conversation.
     */
    public function sendMessage(Request $request, int $id): JsonResponse
    {
        $conversation = Conversation::findOrFail($id);
        $this->authorizeParticipant($request, $conversation);

        $validated = $request->validate([
            'content'          => ['required_without:attachment_url', 'nullable', 'string', 'max:5000'],
            'client_uuid'      => ['nullable', 'string', 'max:64'],
            'reply_to_id'      => ['nullable', 'integer', 'exists:messages,id'],
            'attachment_url'   => ['nullable', 'string', 'max:2000'],
            'attachment_type'  => ['nullable', 'string', 'in:image,file,voice'],
        ]);

        $clientUuid = $validated['client_uuid'] ?? null;

        // Duplicate prevention: if message with client_uuid already exists, return existing
        if ($clientUuid) {
            $existing = Message::where('client_uuid', $clientUuid)->first();
            if ($existing) {
                return response()->json([
                    'data' => $existing->load('user:id,name,username,avatar_url'),
                ]);
            }
        }

        $message = DB::transaction(function () use ($conversation, $request, $validated, $clientUuid) {
            $attachmentType = $validated['attachment_type'] ?? null;
            $messageType    = $attachmentType ?? 'text';

            $msg = Message::create([
                'conversation_id' => $conversation->id,
                'user_id'         => $request->user()->id,
                'content'         => trim($validated['content'] ?? ''),
                'type'            => $messageType,
                'client_uuid'     => $clientUuid,
                'reply_to_id'     => $validated['reply_to_id'] ?? null,
                'attachment_url'  => $validated['attachment_url'] ?? null,
                'attachment_type' => $attachmentType,
            ]);

            // Update conversation updated_at for ordering
            $conversation->touch();

            // Update sender's last_read_at
            ConversationParticipant::where('conversation_id', $conversation->id)
                ->where('user_id', $request->user()->id)
                ->update(['last_read_at' => now()]);

            return $msg;
        });

        $loadedMessage = $message->load([
            'user:id,name,username,avatar_url',
            'replyTo:id,user_id,content,attachment_type',
            'replyTo.user:id,name,username',
        ]);

        // Broadcast event for real-time recipients
        event(new \App\Events\MessageSent($loadedMessage));

        return response()->json([
            'data' => $loadedMessage,
        ], 201);
    }

    /**
     * Mark conversation as read.
     */
    public function markRead(Request $request, int $id): JsonResponse
    {
        $conversation = Conversation::findOrFail($id);
        $this->authorizeParticipant($request, $conversation);

        ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $request->user()->id)
            ->update(['last_read_at' => now()]);

        return response()->json(['message' => 'Conversation marked as read.']);
    }

    /**
     * Fire a typing indicator event (ephemeral, not persisted).
     */
    public function typing(Request $request, int $id): JsonResponse
    {
        $conversation = Conversation::findOrFail($id);
        $this->authorizeParticipant($request, $conversation);

        $validated = $request->validate([
            'is_typing' => ['required', 'boolean'],
        ]);

        event(new \App\Events\TypingIndicator(
            $conversation->id,
            $request->user()->id,
            $request->user()->name,
            $validated['is_typing'],
        ));

        return response()->json(['ok' => true]);
    }

    /**
     * Helper to verify participant authorization.
     */
    private function authorizeParticipant(Request $request, Conversation $conversation): void
    {
        $userId = $request->user()->id;

        if ($conversation->type === 'community' && $conversation->community_id) {
            $isMember = CommunityMembership::where('community_id', $conversation->community_id)
                ->where('user_id', $userId)
                ->whereIn('status', ['active', 'approved'])
                ->exists();

            $isOwner = Community::where('id', $conversation->community_id)
                ->where('creator_id', $userId)
                ->exists();

            if (! $isMember && ! $isOwner) {
                abort(403, 'Must be a member of the community to access messages.');
            }
            return;
        }

        $isParticipant = ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $userId)
            ->exists();

        if (! $isParticipant) {
            abort(403, 'You are not a participant in this conversation.');
        }
    }
}
