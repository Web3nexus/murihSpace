<?php

namespace App\Http\Controllers;

use App\Events\MessageDeleted;
use App\Events\MessageSent;
use App\Events\TypingIndicator;
use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\ConversationUserSetting;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Media;
use App\Models\Message;
use App\Models\MessageUserState;
use App\Models\User;
use App\Models\UserBlock;
use App\Notifications\NewMessageNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
                'latestMessage.user:id,name,username,avatar',
                'users:id,name,username,avatar',
                'community:id,name,slug,logo_url',
                'participants' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                },
            ])
            ->withCount(['participants as member_count'])
            ->get();

        $settings = ConversationUserSetting::where('user_id', $userId)
            ->whereIn('conversation_id', $conversations->pluck('id'))
            ->get()
            ->keyBy('conversation_id');

        $convIds = $conversations->pluck('id');

        $unreadCounts = Message::join('conversation_participants', function ($join) use ($userId) {
            $join->on('conversation_participants.conversation_id', '=', 'messages.conversation_id')
                ->where('conversation_participants.user_id', '=', $userId);
        })
            ->whereIn('messages.conversation_id', $convIds)
            ->where('messages.user_id', '!=', $userId)
            ->whereNull('messages.deleted_at')
            ->where(function ($q) {
                $q->whereNull('conversation_participants.last_read_at')
                    ->orWhereColumn('messages.created_at', '>', 'conversation_participants.last_read_at');
            })
            ->groupBy('messages.conversation_id')
            ->select('messages.conversation_id', DB::raw('count(*) as aggregate'))
            ->pluck('aggregate', 'conversation_id');

        // Query all active/held escrows involving this user
        $activeEscrows = DB::table('escrows')
            ->where(function ($q) use ($userId) {
                $q->where('buyer_id', $userId)->orWhere('seller_id', $userId);
            })
            ->whereIn('status', ['held', 'disputed', 'pending', 'active'])
            ->get();

        $conversations = $conversations
            ->map(function ($conv) use ($userId, $settings, $unreadCounts, $activeEscrows) {
                $unreadCount = (int) ($unreadCounts->get($conv->id) ?? 0);

                // For direct conversations, resolve recipient user
                $otherUser = null;
                $hasActiveEscrow = false;
                $escrowAmount = null;
                $escrowCurrency = 'USD';

                if ($conv->type === 'direct') {
                    $otherUser = $conv->users->firstWhere('id', '!=', $userId);

                    if ($otherUser) {
                        $matchEscrow = $activeEscrows->first(function ($e) use ($userId, $otherUser) {
                            return ($e->buyer_id == $userId && $e->seller_id == $otherUser->id)
                                || ($e->buyer_id == $otherUser->id && $e->seller_id == $userId);
                        });

                        if ($matchEscrow) {
                            $hasActiveEscrow = true;
                            $escrowAmount = $matchEscrow->amount / 100.0;
                            $escrowCurrency = $matchEscrow->currency ?? 'NGN';
                        }
                    }
                }

                $setting = $settings->get($conv->id);

                return [
                    'id' => $conv->id,
                    'type' => $hasActiveEscrow && $conv->type === 'direct' ? 'marketplace' : $conv->type,
                    'title' => $conv->type === 'direct' ? ($otherUser ? $otherUser->name : 'Direct Message') : ($conv->type === 'saved' ? 'Saved Messages' : ($conv->community ? $conv->community->name : ($conv->title ?: 'Conversation'))),
                    'community' => $conv->community,
                    'other_user' => $otherUser,
                    'latest_message' => $conv->latestMessage,
                    'unread_count' => $unreadCount,
                    'updated_at' => $conv->updated_at,
                    'is_archived' => $setting?->is_archived ?? false,
                    'is_muted' => $setting?->is_muted ?? false,
                    'member_count' => $conv->type === 'community' ? $conv->member_count : null,
                    'has_active_escrow' => $hasActiveEscrow,
                    'escrow_amount' => $escrowAmount,
                    'escrow_currency' => $escrowCurrency,
                    'is_financial' => $hasActiveEscrow,
                    'tags' => $hasActiveEscrow ? ['#Business: Escrow Deal', '#Financial'] : [],
                ];
            })
            ->sortByDesc('updated_at')
            ->values();

        return response()->json($conversations);
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

        $targetUser = User::find($targetId);
        $userPayload = $targetUser ? [
            'id' => $targetUser->id,
            'name' => $targetUser->name,
            'username' => $targetUser->username,
            'avatar_url' => $targetUser->avatar_url ?? $targetUser->avatar,
        ] : null;

        if ($existing) {
            return response()->json([
                'data' => [
                    'id' => $existing->id,
                    'type' => 'direct',
                    'title' => $targetUser?->name ?: 'Direct Message',
                    'other_user' => $userPayload,
                    'unread_count' => 0,
                    'updated_at' => $existing->updated_at,
                ],
            ]);
        }

        // Create new direct conversation
        $conversation = DB::transaction(function () use ($authId, $targetId) {
            $conv = Conversation::create(['type' => 'direct']);
            ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $authId, 'last_read_at' => now()]);
            ConversationParticipant::create(['conversation_id' => $conv->id, 'user_id' => $targetId]);

            return $conv;
        });

        return response()->json([
            'data' => [
                'id' => $conversation->id,
                'type' => 'direct',
                'title' => $targetUser?->name ?: 'Direct Message',
                'other_user' => $userPayload,
                'unread_count' => 0,
                'updated_at' => $conversation->updated_at,
            ],
        ], 201);
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

        if (! $isMember && $community->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Must be a community member to access general chat.'], 403);
        }

        $conv = Conversation::firstOrCreate(
            ['type' => 'community', 'community_id' => $communityId],
            ['title' => "{$community->name} General"]
        );

        // Ensure current user is a participant
        ConversationParticipant::firstOrCreate([
            'conversation_id' => $conv->id,
            'user_id' => $request->user()->id,
        ]);

        $conv->load('community:id,name,slug,logo_url');

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

        return response()->json($conv);
    }

    /**
     * Get paginated message history for a conversation.
     */
    public function messages(Request $request, int $id): JsonResponse
    {
        $conversation = $this->resolveConversation($request, $id);
        if (! $conversation) {
            return response()->json([
                'data' => [],
                'current_page' => 1,
                'last_page' => 1,
                'total' => 0,
            ]);
        }
        $this->authorizeParticipant($request, $conversation);
        $id = $conversation->id;

        $messages = Message::where('conversation_id', $id)
            ->visible()
            ->notHiddenForUser($request->user()->id)
            ->with([
                'user:id,name,username,avatar',
                'replyTo:id,user_id,content,attachment_type',
                'replyTo.user:id,name,username',
                'reactions',
            ])
            ->orderBy('created_at', 'asc')
            ->paginate(50);

        // Read receipts: a message I sent is "read" when another participant
        // has a last_read_at at or after its creation time.
        $otherLastReadAt = ConversationParticipant::where('conversation_id', $id)
            ->where('user_id', '!=', $request->user()->id)
            ->pluck('last_read_at')
            ->filter()
            ->map(fn ($ts) => Carbon::parse($ts));

        $messages = $messages->through(function (Message $message) use ($request, $otherLastReadAt) {
            $message->read = false;
            if ($message->user_id === $request->user()->id && $otherLastReadAt->isNotEmpty()) {
                $message->read = $otherLastReadAt->contains(
                    fn ($readAt) => $message->created_at->lessThanOrEqualTo($readAt)
                );
            }

            return $message;
        });

        return response()->json($messages);
    }

    /**
     * Send a text message to a conversation.
     */
    public function sendMessage(Request $request, int $id): JsonResponse
    {
        $conversation = $this->resolveConversation($request, $id);
        if (! $conversation) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        }
        $this->authorizeParticipant($request, $conversation);

        // Financial chat speed limit check ("manage illegal speed from admin")
        $isFinancialChat = $conversation->type === 'marketplace'
            || DB::table('escrows')->where(function ($q) use ($conversation) {
                $userIds = $conversation->participants()->pluck('user_id');
                $q->whereIn('buyer_id', $userIds)->whereIn('seller_id', $userIds);
            })->exists();

        if ($isFinancialChat) {
            $speedKey = "chat_speed:{$conversation->id}:{$request->user()->id}";
            $maxMessages = (int) cache()->get('admin_chat_speed_max_messages', 5);
            $windowSeconds = (int) cache()->get('admin_chat_speed_window_seconds', 5);
            $msgCount = (int) cache()->get($speedKey, 0);

            if ($msgCount >= $maxMessages) {
                return response()->json([
                    'message' => 'Speed limit reached in financial deal chat. High-frequency messaging is restricted to protect transaction security and prevent bot exploits. Please wait a few seconds.',
                ], 429);
            }

            cache()->put($speedKey, $msgCount + 1, now()->addSeconds($windowSeconds));
        }

        $validated = $request->validate([
            'content' => ['required_without:attachment_url', 'nullable', 'string', 'max:5000'],
            'client_uuid' => ['nullable', 'string', 'max:64'],
            'reply_to_id' => ['nullable', 'integer', 'exists:messages,id'],
            'attachment_url' => ['nullable', 'string', 'max:2000'],
            'attachment_type' => ['nullable', 'string', 'in:image,file,voice,poll,location,contact'],
            'media_id' => ['nullable', 'integer', 'exists:media,id'],
            'media_status' => ['nullable', 'string', 'in:uploading,processing,ready,failed,rejected'],
        ]);

        $clientUuid = $validated['client_uuid'] ?? null;

        // Duplicate prevention: if message with client_uuid already exists, return existing
        if ($clientUuid) {
            $existing = Message::where('client_uuid', $clientUuid)->first();
            if ($existing) {
                return response()->json(
                    $existing->load('user:id,name,username,avatar')
                );
            }
        }

        $message = DB::transaction(function () use ($conversation, $request, $validated, $clientUuid) {
            $attachmentType = $validated['attachment_type'] ?? null;
            $messageType = $attachmentType ?? 'text';

            $mediaStatus = null;
            $media = null;
            if ($validated['media_id'] ?? null) {
                $media = Media::find($validated['media_id']);
                $mediaStatus = $media
                    ? Message::MEDIA_STATUS_READY
                    : Message::MEDIA_STATUS_FAILED;
            }

            $msg = Message::create([
                'conversation_id' => $conversation->id,
                'user_id' => $request->user()->id,
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

            $media?->incrementReferenceCount();

            // Update conversation updated_at for ordering
            $conversation->touch();

            // Update sender's last_read_at
            ConversationParticipant::where('conversation_id', $conversation->id)
                ->where('user_id', $request->user()->id)
                ->update(['last_read_at' => now()]);

            return $msg;
        });

        $loadedMessage = $message->load([
            'user:id,name,username,avatar',
            'replyTo:id,user_id,content,attachment_type',
            'replyTo.user:id,name,username',
        ]);

        // Broadcast event for real-time recipients
        event(new MessageSent($loadedMessage));

        // Send in-app notification to other participants
        $conversation->participants()
            ->where('user_id', '!=', $request->user()->id)
            ->with('user')
            ->get()
            ->each(function ($participant) use ($loadedMessage, $conversation, $request) {
                if ($participant->user) {
                    $participant->user->notify(new NewMessageNotification(
                        $loadedMessage,
                        $conversation,
                        $request->user(),
                    ));
                }
            });

        return response()->json($loadedMessage, 201);
    }

    /**
     * Delete a message (for me or for everyone).
     */
    public function deleteMessage(Request $request, int $conversationId, int $messageId): JsonResponse
    {
        $conversation = Conversation::findOrFail($conversationId);
        $this->authorizeParticipant($request, $conversation);

        $message = Message::where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        $mode = $request->input('mode', 'me');

        if ($mode === 'everyone') {
            if ($message->user_id !== $request->user()->id) {
                $isMod = CommunityMembership::where('community_id', $conversation->community_id)
                    ->where('user_id', $request->user()->id)
                    ->whereIn('role', ['admin', 'moderator'])
                    ->exists();
                if (! $isMod) {
                    return response()->json(['message' => 'Only the sender or a moderator can delete for everyone.'], 403);
                }
            }

            DB::transaction(function () use ($message) {
                $message->update(['status' => Message::STATUS_DELETED, 'content' => '', 'attachment_url' => null]);
                $message->delete();

                if ($message->media_id) {
                    $media = $message->media;
                    if ($media) {
                        $media->decrementReferenceCount();
                    }
                }
            });

            event(new MessageDeleted($message, $conversation->id));

            return response()->json(['message' => 'Message deleted for everyone.']);
        }

        // Delete for me: hide via user state
        MessageUserState::updateOrCreate(
            ['message_id' => $message->id, 'user_id' => $request->user()->id],
            ['is_hidden' => true],
        );

        return response()->json(['message' => 'Message hidden.']);
    }

    /**
     * Clear all messages in a conversation (for me or for everyone).
     */
    public function clearMessages(Request $request, int $conversationId): JsonResponse
    {
        $conversation = Conversation::findOrFail($conversationId);
        $this->authorizeParticipant($request, $conversation);

        $mode = $request->input('mode', 'me');

        // ── Financial / escrow chat hard-delete protection ───────────────────
        // Commerce/creator chats tagged as marketplace or with an active escrow
        // deal must NEVER be hard-deleted. All records remain in the database
        // for audit compliance, dispute arbitration, and fund verification.
        // Users may only soft-clear their own view (mode=me).
        if ($mode === 'everyone') {
            $participantIds = $conversation->participants()->pluck('user_id');
            $isFinancial = $conversation->type === 'marketplace'
                || DB::table('escrows')
                    ->where(function ($q) use ($participantIds) {
                        $q->whereIn('buyer_id', $participantIds)
                          ->whereIn('seller_id', $participantIds);
                    })
                    ->whereIn('status', ['held', 'active', 'pending', 'disputed'])
                    ->exists();

            if ($isFinancial) {
                return response()->json([
                    'success' => false,
                    'message' => 'Financial and escrow deal chats cannot be permanently deleted. All records are legally preserved for audit compliance, dispute arbitration, and fund verification. You can soft-clear your personal view only.',
                    'can_soft_clear' => true,
                ], 403);
            }
        }

        if ($mode === 'everyone') {
            if ($conversation->type === 'direct') {
                // In direct chat, either participant can clear for everyone
                $messages = Message::where('conversation_id', $conversationId)->get();
                DB::transaction(function () use ($messages) {
                    foreach ($messages as $msg) {
                        $msg->update(['status' => Message::STATUS_DELETED, 'content' => '', 'attachment_url' => null]);
                        $msg->delete();
                    }
                });
                return response()->json(['message' => 'Chat history cleared for everyone.']);
            } else {
                $isMod = CommunityMembership::where('community_id', $conversation->community_id)
                    ->where('user_id', $request->user()->id)
                    ->whereIn('role', ['admin', 'moderator'])
                    ->exists();

                if (! $isMod && $conversation->creator_id !== $request->user()->id) {
                    return response()->json(['message' => 'Only admins can clear chat for everyone in groups.'], 403);
                }

                $messages = Message::where('conversation_id', $conversationId)->get();
                DB::transaction(function () use ($messages) {
                    foreach ($messages as $msg) {
                        $msg->update(['status' => Message::STATUS_DELETED, 'content' => '', 'attachment_url' => null]);
                        $msg->delete();
                    }
                });
                return response()->json(['message' => 'Chat history cleared for everyone.']);
            }
        }

        // Delete for me: hide all messages for this user
        $messageIds = Message::where('conversation_id', $conversationId)->pluck('id');
        $userId = $request->user()->id;

        DB::transaction(function () use ($messageIds, $userId) {
            foreach ($messageIds as $msgId) {
                MessageUserState::updateOrCreate(
                    ['message_id' => $msgId, 'user_id' => $userId],
                    ['is_hidden' => true]
                );
            }
        });

        return response()->json(['message' => 'Chat history cleared for you.']);
    }

    /**
     * Get mutual groups and communities shared between auth user and target user.
     */
    public function mutualCommunities(Request $request, int $userId): JsonResponse
    {
        $authId = $request->user()->id;
        $targetUser = User::findOrFail($userId);

        // Find common communities
        $authCommunityIds = CommunityMembership::where('user_id', $authId)
            ->whereIn('status', ['active', 'approved'])
            ->pluck('community_id');

        $targetCommunityIds = CommunityMembership::where('user_id', $userId)
            ->whereIn('status', ['active', 'approved'])
            ->pluck('community_id');

        $mutualCommunityIds = $authCommunityIds->intersect($targetCommunityIds);

        $communities = Community::whereIn('id', $mutualCommunityIds)
            ->withCount('memberships as members_count')
            ->get()
            ->map(function ($c) {
                return [
                    'id' => $c->id,
                    'type' => 'community',
                    'name' => $c->name,
                    'slug' => $c->slug,
                    'description' => $c->description,
                    'logo_url' => $c->logo_url ?? $c->cover_url,
                    'tag' => '#' . ($c->category ?? 'Community'),
                    'members_count' => $c->members_count ?? 1,
                ];
            });

        // Find common groups
        $authGroupIds = GroupMember::where('user_id', $authId)
            ->where('status', 'active')
            ->pluck('group_id');

        $targetGroupIds = GroupMember::where('user_id', $userId)
            ->where('status', 'active')
            ->pluck('group_id');

        $mutualGroupIds = $authGroupIds->intersect($targetGroupIds);

        $groups = Group::whereIn('id', $mutualGroupIds)
            ->withCount('members as members_count')
            ->get()
            ->map(function ($g) {
                return [
                    'id' => $g->id,
                    'type' => 'group',
                    'name' => $g->name,
                    'slug' => (string) $g->id,
                    'description' => $g->description,
                    'logo_url' => $g->avatar_url,
                    'tag' => '#PrivateGroup',
                    'members_count' => $g->members_count ?? 2,
                ];
            });

        $items = $communities->concat($groups)->values();

        return response()->json([
            'communities' => $items,
            'count' => $items->count(),
        ]);
    }

    /**
     * Forward a message (with media reuse) to another conversation.
     */
    public function forwardMessage(Request $request, int $messageId): JsonResponse
    {
        $original = Message::with('media')->findOrFail($messageId);

        $validated = $request->validate([
            'to_conversation_id' => ['required', 'integer', 'exists:conversations,id'],
            'client_uuid' => ['nullable', 'string', 'max:64'],
        ]);

        $targetConv = Conversation::findOrFail($validated['to_conversation_id']);
        $this->authorizeParticipant($request, $targetConv);

        $this->authorizeParticipant($request, $original->conversation);

        $clientUuid = $validated['client_uuid'] ?? null;
        if ($clientUuid) {
            $existing = Message::where('client_uuid', $clientUuid)->first();
            if ($existing) {
                return response()->json(['data' => $existing->load('user:id,name,username,avatar')]);
            }
        }

        $message = DB::transaction(function () use ($request, $targetConv, $original, $clientUuid) {
            $msg = Message::create([
                'conversation_id' => $targetConv->id,
                'user_id' => $request->user()->id,
                'content' => $original->content,
                'type' => $original->type,
                'status' => Message::STATUS_SENT,
                'client_uuid' => $clientUuid,
                'forwarded_from_message_id' => $original->id,
                'attachment_url' => $original->attachment_url,
                'attachment_type' => $original->attachment_type,
                'media_id' => $original->media_id,
                'media_status' => $original->media_status,
            ]);

            if ($original->media_id) {
                $original->media?->incrementReferenceCount();
            }

            $targetConv->touch();

            ConversationParticipant::where('conversation_id', $targetConv->id)
                ->where('user_id', $request->user()->id)
                ->update(['last_read_at' => now()]);

            return $msg;
        });

        $loadedMessage = $message->load([
            'user:id,name,username,avatar',
            'forwardedFrom:id,user_id,content',
            'forwardedFrom.user:id,name,username',
        ]);

        event(new MessageSent($loadedMessage));

        $targetConv->participants()
            ->where('user_id', '!=', $request->user()->id)
            ->with('user')
            ->get()
            ->each(function ($participant) use ($loadedMessage, $targetConv, $request) {
                if ($participant->user) {
                    $participant->user->notify(new NewMessageNotification(
                        $loadedMessage,
                        $targetConv,
                        $request->user(),
                    ));
                }
            });

        return response()->json(['data' => $loadedMessage], 201);
    }

    /**
     * Mark conversation as read.
     */
    public function markRead(Request $request, int $id): JsonResponse
    {
        $conversation = $this->resolveConversation($request, $id);
        if (! $conversation) {
            return response()->json(['message' => 'Conversation marked as read.']);
        }
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
        $conversation = $this->resolveConversation($request, $id);
        if (! $conversation) {
            return response()->json(['ok' => true]);
        }
        $this->authorizeParticipant($request, $conversation);

        $validated = $request->validate([
            'is_typing' => ['required', 'boolean'],
        ]);

        event(new TypingIndicator(
            $conversation->id,
            $request->user()->id,
            $request->user()->name,
            $validated['is_typing'],
        ));

        return response()->json(['ok' => true]);
    }

    /**
     * Resolve conversation by ID, or seamlessly resolve synthetic direct ID (e.g. 9000 + userId).
     */
    private function resolveConversation(Request $request, int $id): ?Conversation
    {
        $conversation = Conversation::find($id);
        if ($conversation) {
            return $conversation;
        }

        // If ID is synthetic fallback (e.g. 9000 + userId)
        if ($id >= 9000 && $id < 100000) {
            $targetUserId = $id - 9000;
            $authId = $request->user()->id;

            if ($targetUserId !== $authId && User::where('id', $targetUserId)->exists()) {
                $existing = Conversation::where('type', 'direct')
                    ->whereHas('participants', fn ($q) => $q->where('user_id', $authId))
                    ->whereHas('participants', fn ($q) => $q->where('user_id', $targetUserId))
                    ->first();

                if ($existing) {
                    return $existing;
                }

                return DB::transaction(function () use ($authId, $targetUserId) {
                    $c = Conversation::create(['type' => 'direct']);
                    ConversationParticipant::create(['conversation_id' => $c->id, 'user_id' => $authId, 'last_read_at' => now()]);
                    ConversationParticipant::create(['conversation_id' => $c->id, 'user_id' => $targetUserId]);
                    return $c;
                });
            }
        }

        return null;
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
                ->where('user_id', $userId)
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

    public function stats(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $unreadCount = Message::query()
            ->where('user_id', '!=', $userId)
            ->whereExists(function ($q) use ($userId) {
                $q->selectRaw('1')
                    ->from('conversation_participants')
                    ->whereColumn('conversation_participants.conversation_id', 'messages.conversation_id')
                    ->where('conversation_participants.user_id', $userId)
                    ->where(function ($q) {
                        $q->whereNull('conversation_participants.last_read_at')
                            ->orWhereColumn('conversation_participants.last_read_at', '<', 'messages.created_at');
                    });
            })
            ->count();

        return response()->json([
            'data' => [
                'total_conversations' => Conversation::whereHas('participants', fn ($q) => $q->where('user_id', $userId))->count(),
                'unread_messages' => $unreadCount,
                'total_messages_sent' => Message::where('user_id', $userId)->count(),
            ],
        ]);
    }

    public function recentActivity(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $messages = Message::where('user_id', $userId)
            ->orWhereHas('conversation.participants', fn ($q) => $q->where('user_id', $userId))
            ->with(['conversation', 'user'])
            ->latest()
            ->take(10)
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'conversation_id' => $m->conversation_id,
                'conversation_title' => $m->conversation?->title ?? 'Direct Message',
                'content' => mb_substr($m->content, 0, 100),
                'sender_name' => $m->user?->name,
                'is_mine' => $m->user_id === $userId,
                'created_at' => $m->created_at->toIso8601String(),
            ]);

        return response()->json(['data' => $messages]);
    }

    /**
     * Audit Archive — Admin/compliance endpoint.
     * Retrieves the full preserved message history for a financial/escrow conversation,
     * even if users have soft-cleared their view. Only accessible by platform admins.
     */
    public function auditArchive(Request $request, int $conversationId): JsonResponse
    {
        $authUser = $request->user();

        $isAdmin = $authUser->hasRole('admin')
            || $authUser->hasRole('super_admin')
            || CommunityMembership::where('user_id', $authUser->id)
                ->whereIn('role', ['admin', 'moderator'])
                ->exists();

        if (! $isAdmin) {
            return response()->json(['message' => 'Access denied. Audit archive requires admin privileges.'], 403);
        }

        $conversation = Conversation::findOrFail($conversationId);

        // Fetch ALL messages including soft-deleted — ignore MessageUserState hidden flags
        $messages = Message::withTrashed()
            ->where('conversation_id', $conversationId)
            ->with(['user:id,name,username,avatar_url', 'attachments'])
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(fn ($m) => [
                'id'              => $m->id,
                'conversation_id' => $m->conversation_id,
                'sender_id'       => $m->user_id,
                'sender_name'     => $m->user?->name,
                'sender_username' => $m->user?->username,
                'content'         => $m->content,
                'type'            => $m->type ?? 'text',
                'status'          => $m->status,
                'created_at'      => $m->created_at?->toIso8601String(),
                'deleted_at'      => $m->deleted_at?->toIso8601String(),
                'attachments'     => $m->attachments ?? [],
            ]);

        return response()->json([
            'conversation_id'    => $conversationId,
            'conversation_type'  => $conversation->type,
            'audit_retrieved_by' => $authUser->id,
            'audit_retrieved_at' => now()->toIso8601String(),
            'total_messages'     => $messages->count(),
            'messages'           => $messages,
        ]);
    }

    /**
     * Admin speed control — Anti-bot / illegal-speed rate limit for financial chats.
     * POST /conversations/speed-control
     * Body: { max_messages: int, window_seconds: int }
     */
    public function updateSpeedControl(Request $request): JsonResponse
    {
        $authUser = $request->user();
        if (! $authUser->hasRole('admin') && ! $authUser->hasRole('super_admin')) {
            return response()->json(['message' => 'Only platform admins can update speed control settings.'], 403);
        }

        $validated = $request->validate([
            'max_messages'   => 'required|integer|min:1|max:100',
            'window_seconds' => 'required|integer|min:1|max:60',
        ]);

        DB::table('admin_settings')->updateOrInsert(
            ['key' => 'chat_speed_max_messages'],
            ['value' => $validated['max_messages'], 'updated_at' => now()]
        );
        DB::table('admin_settings')->updateOrInsert(
            ['key' => 'chat_speed_window_seconds'],
            ['value' => $validated['window_seconds'], 'updated_at' => now()]
        );

        return response()->json([
            'message'        => 'Financial chat speed control updated successfully.',
            'max_messages'   => $validated['max_messages'],
            'window_seconds' => $validated['window_seconds'],
        ]);
    }
}
