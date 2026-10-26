<?php

namespace App\Http\Controllers;

use App\Events\MessageDeleted;
use App\Events\MessageEdited;
use App\Events\MessageSent;
use App\Events\TypingIndicator;
use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\ConversationUserSetting;
use App\Models\AdminSetting;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Media;
use App\Models\Message;
use App\Models\Meeting;
use App\Models\MessageUserState;
use App\Models\User;
use App\Models\UserBlock;
use App\Notifications\NewMessageNotification;
use App\Services\MessageEditingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use App\Services\Chat\BusinessChatPolicy;

class ConversationController extends Controller
{
    /**
     * List all conversations for the authenticated user with latest message and unread count.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $userId = $user->id;
        $user->forceFill(['last_seen_at' => now()])->saveQuietly();

        $conversations = Conversation::whereHas('participants', function ($q) use ($userId) {
            $q->where('user_id', $userId);
        })
            ->with([
                'latestMessage.user:id,name,username,avatar',
                'users:id,name,username,avatar,last_seen_at,show_online_status',
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

        // Business status for every direct chat in one pass, not several queries per conversation.
        $directOtherIds = $conversations
            ->where('type', 'direct')
            ->map(fn ($conv) => $conv->users->firstWhere('id', '!=', $userId)?->id)
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
        $businessCounterparts = array_flip(app(BusinessChatPolicy::class)->businessCounterparts($userId, $directOtherIds));

        $conversations = $conversations
            ->map(function ($conv) use ($userId, $settings, $unreadCounts, $activeEscrows, $businessCounterparts) {
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
                            $escrowCurrency = $matchEscrow->currency ?? 'USD';
                        }
                    }
                }

                $setting = $settings->get($conv->id);

                $otherUserPayload = null;
                if ($otherUser) {
                    $otherUserPayload = array_merge($otherUser->toArray(), [
                        'is_online' => $otherUser->isOnline(),
                        'last_seen' => $otherUser->lastSeenForHuman(),
                    ]);
                }

                return [
                    'id' => $conv->id,
                    'type' => $hasActiveEscrow && $conv->type === 'direct' ? 'marketplace' : $conv->type,
                    'title' => $conv->type === 'direct' ? ($otherUser ? $otherUser->name : 'Direct Message') : ($conv->type === 'saved' ? 'Saved Messages' : ($conv->community ? $conv->community->name : ($conv->title ?: 'Conversation'))),
                    'community' => $conv->community,
                    'other_user' => $otherUserPayload,
                    'latest_message' => $conv->latestMessage,
                    'unread_count' => $unreadCount,
                    'updated_at' => $conv->updated_at,
                    'is_pinned' => (bool) $setting?->pinned_at,
                    'is_archived' => $setting?->is_archived ?? false,
                    'is_muted' => $setting?->is_muted ?? false,
                    'member_count' => $conv->type === 'community' ? $conv->member_count : null,
                    'has_active_escrow' => $hasActiveEscrow,
                    'escrow_amount' => $escrowAmount,
                    'escrow_currency' => $escrowCurrency,
                    'is_financial' => $hasActiveEscrow,
                    'tags' => $hasActiveEscrow ? ['#Business: Escrow Deal', '#Financial'] : [],
                    'is_business' => $conv->type === 'marketplace'
                        || ($otherUser !== null && isset($businessCounterparts[(int) $otherUser->id])),
                ];
            })
            ->sort(function ($a, $b) {
                if ((bool) $a['is_pinned'] !== (bool) $b['is_pinned']) {
                    return $a['is_pinned'] ? -1 : 1;
                }
                $aT = $a['updated_at'] instanceof Carbon ? $a['updated_at']->getTimestamp() : strtotime((string) $a['updated_at']);
                $bT = $b['updated_at'] instanceof Carbon ? $b['updated_at']->getTimestamp() : strtotime((string) $b['updated_at']);

                return $bT <=> $aT;
            })
            ->values();

        return response()->json($conversations);
    }

    /**
     * Total unread message count across all conversations for the user.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $count = Message::join('conversation_participants', function ($join) use ($userId) {
            $join->on('conversation_participants.conversation_id', '=', 'messages.conversation_id')
                ->where('conversation_participants.user_id', '=', $userId);
        })
            ->where('messages.user_id', '!=', $userId)
            ->whereNull('messages.deleted_at')
            ->where(function ($q) {
                $q->whereNull('conversation_participants.last_read_at')
                    ->orWhereColumn('messages.created_at', '>', 'conversation_participants.last_read_at');
            })
            ->count();

        return response()->json(['unread_count' => $count]);
    }

    /**
     * Public chat configuration for clients (pin limit, etc.).
     */
    public function chatConfig(Request $request): JsonResponse
    {
        return response()->json([
            'max_pinned_chats' => (int) AdminSetting::get('max_pinned_chats', 3),
        ]);
    }

    /**
     * Admin chat configuration update.
     * POST /conversations/pin-config
     * Body: { max_pinned_chats: int }
     */
    public function updatePinConfig(Request $request): JsonResponse
    {
        $authUser = $request->user();
        if (! $authUser->hasRole('admin') && ! $authUser->hasRole('super_admin')) {
            return response()->json(['message' => 'Only platform admins can update chat pin settings.'], 403);
        }

        $validated = $request->validate([
            'max_pinned_chats' => 'required|integer|min:1|max:50',
        ]);

        AdminSetting::set('max_pinned_chats', $validated['max_pinned_chats']);

        return response()->json([
            'message' => 'Chat pin limit updated successfully.',
            'max_pinned_chats' => $validated['max_pinned_chats'],
        ]);
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
            'is_online' => $targetUser->isOnline(),
            'last_seen' => $targetUser->lastSeenForHuman(),
            'greeting_message_enabled' => (bool) $targetUser->greeting_message_enabled,
            'greeting_message' => $targetUser->greeting_message_enabled ? $targetUser->greeting_message : null,
        ] : null;

        if ($existing) {
            return response()->json([
                'id' => $existing->id,
                'type' => 'direct',
                'title' => $targetUser?->name ?: 'Direct Message',
                'other_user' => $userPayload,
                'unread_count' => 0,
                'updated_at' => $existing->updated_at,
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
            'id' => $conversation->id,
            'type' => 'direct',
            'title' => $targetUser?->name ?: 'Direct Message',
            'other_user' => $userPayload,
            'unread_count' => 0,
            'updated_at' => $conversation->updated_at,
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

        return response()->json($conv);
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
            ->orderBy('created_at', 'desc')
            ->paginate(50);

        // Read receipts: a message I sent is "read" when another participant
        // has a last_read_at at or after its creation time.
        $otherLastReadAt = ConversationParticipant::where('conversation_id', $id)
            ->where('user_id', '!=', $request->user()->id)
            ->pluck('last_read_at')
            ->filter()
            ->map(fn ($ts) => Carbon::parse($ts));

        $messages = $messages->through(function (Message $message) use ($request, $otherLastReadAt) {
            if ($message->user_id === $request->user()->id) {
                $message->read = false;
                if ($otherLastReadAt->isNotEmpty()) {
                    $message->read = $otherLastReadAt->contains(
                        fn ($readAt) => $message->created_at->lessThanOrEqualTo($readAt)
                    );
                    if ($message->read) {
                        $message->status = Message::STATUS_READ;
                    }
                }
            } else {
                $message->read = ($message->status === Message::STATUS_READ);
            }

            return $message;
        });

        // Lets the app hide "delete for everyone" while a business chat is locked, and show when it opens.
        $body = $messages->toArray();
        $body['delete_for_everyone_unlocks_at'] = app(BusinessChatPolicy::class)->unlocksAt($conversation)?->toIso8601String();

        return response()->json($body);
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
        $request->user()->forceFill(['last_seen_at' => now()])->saveQuietly();

        if ($this->isBlockedInDirectChat($conversation, $request->user()->id)) {
            return response()->json([
                'message' => 'You cannot message this person. One of you has blocked the other.',
                'code' => 'BLOCKED',
            ], 403);
        }

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
            'content' => ['required_without_all:attachment_url,ciphertext', 'nullable', 'string', 'max:5000'],
            'ciphertext' => ['nullable', 'string', 'max:65536'],
            'encryption' => ['nullable', 'string', 'in:signal_v1'],
            'client_uuid' => ['nullable', 'string', 'max:64'],
            'reply_to_id' => ['nullable', 'integer', 'exists:messages,id'],
            'attachment_url' => ['nullable', 'string', 'max:2000'],
            'attachment_type' => ['nullable', 'string', 'in:image,file,voice,poll,location,contact,gift,community,video,audio,live_stream'],
            'media_id' => ['nullable', 'integer', 'exists:media,id'],
            'media_status' => ['nullable', 'string', 'in:uploading,processing,ready,failed,rejected'],
        ]);

        // An encrypted message carries ciphertext only. Plaintext next to it, or
        // ciphertext without the encryption type, is refused so nothing readable
        // is ever stored under an encrypted row.
        if (($validated['encryption'] ?? null) !== null && empty($validated['ciphertext'] ?? null)) {
            return response()->json(['message' => 'Encrypted messages need ciphertext.'], 422);
        }
        if (($validated['encryption'] ?? null) === null && ! empty($validated['ciphertext'] ?? null)) {
            return response()->json(['message' => 'Ciphertext needs an encryption type.'], 422);
        }
        if (($validated['encryption'] ?? null) !== null && trim((string) ($validated['content'] ?? '')) !== '') {
            return response()->json(['message' => 'Encrypted messages cannot include plaintext content.'], 422);
        }

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
                'encryption' => $validated['encryption'] ?? null,
                'ciphertext' => $validated['ciphertext'] ?? null,
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

                    // Dispatch standard Push Notification for Chat Message via FcmService
                    try {
                        $preview = $loadedMessage->encryption
                            ? 'New encrypted message'
                            : mb_substr($loadedMessage->content ?? 'Sent an attachment', 0, 120);
                        \App\Services\FcmService::sendToUser(
                            $participant->user->id,
                            $request->user()->name,
                            $preview,
                            [
                                'type'            => 'new_message',
                                'conversation_id' => (string) $conversation->id,
                                'sender_name'     => $request->user()->name,
                            ]
                        );
                    } catch (\Throwable $e) {
                        \Illuminate\Support\Facades\Log::error('[ConversationController] FCM push failed for user ' . $participant->user->id . ': ' . $e->getMessage());
                    }
                }
            });

        // ── Automated Greeting & Away Message Handling ─────────────────
        $automatedMessage = null;
        if ($conversation->type === 'direct') {
            $otherParticipant = $conversation->participants()
                ->where('user_id', '!=', $request->user()->id)
                ->with('user')
                ->first();

            $recipientUser = $otherParticipant?->user;
            if ($recipientUser) {
                $shouldSendGreeting = false;
                $autoContent = null;

                // 1. Check Greeting Message
                if ($recipientUser->greeting_message_enabled && !empty(trim((string) $recipientUser->greeting_message))) {
                    // Check if recipient has ever sent a message in this conversation, or if all messages were > 14 days ago
                    $lastRecipientMsg = Message::where('conversation_id', $conversation->id)
                        ->where('user_id', $recipientUser->id)
                        ->latest('created_at')
                        ->first();

                    if (! $lastRecipientMsg || $lastRecipientMsg->created_at->lt(now()->subDays(14))) {
                        $shouldSendGreeting = true;
                        $autoContent = trim($recipientUser->greeting_message);
                    }
                }

                // 2. Check Away Message (if greeting not triggered, recipient is away/offline)
                if (! $shouldSendGreeting && $recipientUser->away_message_enabled && !empty(trim((string) $recipientUser->away_message))) {
                    if (! $recipientUser->isOnline()) {
                        $recentAway = Message::where('conversation_id', $conversation->id)
                            ->where('user_id', $recipientUser->id)
                            ->where('is_automated', true)
                            ->where('created_at', '>=', now()->subHours(24))
                            ->exists();

                        if (! $recentAway) {
                            $autoContent = trim($recipientUser->away_message);
                        }
                    }
                }

                // If greeting or away message is qualified, create and dispatch it
                if ($autoContent !== null) {
                    $autoMsg = Message::create([
                        'conversation_id' => $conversation->id,
                        'user_id' => $recipientUser->id,
                        'content' => $autoContent,
                        'type' => 'text',
                        'status' => Message::STATUS_SENT,
                        'is_automated' => true,
                        'client_uuid' => (string) \Illuminate\Support\Str::uuid(),
                    ]);

                    $conversation->touch();

                    $loadedAutoMsg = $autoMsg->load([
                        'user:id,name,username,avatar',
                        'replyTo:id,user_id,content,attachment_type',
                        'replyTo.user:id,name,username',
                    ]);

                    event(new MessageSent($loadedAutoMsg));

                    $request->user()->notify(new NewMessageNotification(
                        $loadedAutoMsg,
                        $conversation,
                        $recipientUser
                    ));

                    try {
                        $preview = mb_substr($loadedAutoMsg->content ?? 'Sent an automated reply', 0, 120);
                        \App\Services\FcmService::sendToUser(
                            $request->user()->id,
                            $recipientUser->name,
                            $preview,
                            [
                                'type'            => 'new_message',
                                'conversation_id' => (string) $conversation->id,
                                'sender_name'     => $recipientUser->name,
                                'is_automated'    => '1',
                            ]
                        );
                    } catch (\Throwable $e) {
                        \Illuminate\Support\Facades\Log::error('[ConversationController] FCM push for auto message failed for user ' . $request->user()->id . ': ' . $e->getMessage());
                    }

                    $automatedMessage = $loadedAutoMsg;
                }
            }
        }

        $responseData = $loadedMessage->toArray();
        if ($automatedMessage) {
            $responseData['automated_message'] = $automatedMessage;
        }

        return response()->json($responseData, 201);
    }

    /**
     * Delete a message (for me or for everyone).
     */
    public function deleteMessage(Request $request, int $conversationId, int $messageId, BusinessChatPolicy $policy): JsonResponse
    {
        $conversation = Conversation::findOrFail($conversationId);
        $this->authorizeParticipant($request, $conversation);

        $message = Message::where('conversation_id', $conversationId)
            ->findOrFail($messageId);

        $mode = $request->input('mode', 'me');

        // Business chats keep their messages for both parties while they are active.
        // Deleting for yourself stays allowed; deleting for everyone waits six months after the last message.
        if ($mode === 'everyone' && $policy->deleteForEveryoneLocked($conversation)) {
            return $this->businessChatLocked($policy, $conversation);
        }

        if ($mode === 'everyone') {
            $isSender = $message->user_id === $request->user()->id;
            $isMod = false;
            if (! $isSender) {
                $isMod = CommunityMembership::where('community_id', $conversation->community_id)
                    ->where('user_id', $request->user()->id)
                    ->whereIn('role', ['admin', 'moderator'])
                    ->exists();
                if (! $isMod) {
                    return response()->json(['message' => 'Only the sender or a moderator can delete for everyone.'], 403);
                }
            }

            // Sender constraints for "Delete for everyone":
            // 1. Recipient must not have read the message yet.
            // 2. Message must be within the configured time window (default 15 minutes).
            if ($isSender && ! $isMod) {
                $otherLastReadAt = ConversationParticipant::where('conversation_id', $conversationId)
                    ->where('user_id', '!=', $request->user()->id)
                    ->pluck('last_read_at')
                    ->filter()
                    ->map(fn ($ts) => Carbon::parse($ts));

                $isRead = $otherLastReadAt->contains(
                    fn ($readAt) => $message->created_at && $message->created_at->lessThanOrEqualTo($readAt)
                );

                if ($isRead) {
                    return response()->json([
                        'message' => 'This message cannot be deleted for everyone because the recipient has already read it.',
                    ], 422);
                }

                $windowMinutes = (int) config('murihspace.chat.delete_everyone_window_minutes', 15);
                if ($windowMinutes > 0 && $message->created_at && $message->created_at->copy()->addMinutes($windowMinutes)->isPast()) {
                    return response()->json([
                        'message' => "Messages can only be deleted for everyone within {$windowMinutes} minutes of sending.",
                    ], 422);
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
     * Correct a message the sender just posted.
     *
     * PATCH /conversations/{conversationId}/messages/{messageId}
     *
     * The window and ownership rules live in MessageEditingService so the
     * client can mirror them for the affordance while the server stays the
     * only thing that actually decides. Previous text is retained as an audit
     * revision rather than overwritten.
     */
    public function editMessage(Request $request, int $conversationId, int $messageId): JsonResponse
    {
        $conversation = Conversation::findOrFail($conversationId);
        $this->authorizeParticipant($request, $conversation);

        /** @var MessageEditingService $editing */
        $editing = app(MessageEditingService::class);

        $validated = $request->validate([
            'content' => ['required', 'string', 'max:'.$editing->maxLength()],
        ]);

        $message = Message::where('conversation_id', $conversationId)
            ->withTrashed()
            ->findOrFail($messageId);

        $content = trim($validated['content']);

        if ($reason = $editing->blockedReason($message, $request->user())) {
            return response()->json([
                'message' => $editing->messageFor($reason),
                'reason' => $reason,
            ], $editing->statusFor($reason));
        }

        // Re-submitting identical text is a no-op, not an edit: it should not
        // produce an audit revision or flip the "edited" marker.
        if ($content === trim((string) $message->content)) {
            return response()->json([
                'message' => $editing->messageFor(MessageEditingService::REASON_UNCHANGED),
                'reason' => MessageEditingService::REASON_UNCHANGED,
            ], 422);
        }

        $updated = $editing->apply($message, $request->user(), $content);

        $updated->load([
            'user:id,name,username,avatar',
            'replyTo:id,user_id,content,attachment_type',
            'replyTo.user:id,name,username',
        ]);

        event(new MessageEdited($updated, (int) $request->user()->id));

        return response()->json([
            'message' => 'Message updated.',
            'data' => $updated,
        ]);
    }

    /**
     * Whether a conversation is a financial/escrow deal that must be preserved.
     *
     * True for marketplace chats, or any chat whose participants are party to an
     * escrow that is currently held/active/pending/disputed.
     */
    private function businessChatLocked(BusinessChatPolicy $policy, Conversation $conversation): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => BusinessChatPolicy::LOCKED_MESSAGE,
            'can_soft_clear' => true,
            'unlocks_at' => $policy->unlocksAt($conversation)?->toIso8601String(),
        ], 403);
    }

    /**
     * Clear all messages in a conversation (for me or for everyone).
     */
    public function clearMessages(Request $request, int $conversationId, BusinessChatPolicy $policy): JsonResponse
    {
        $conversation = Conversation::findOrFail($conversationId);
        $this->authorizeParticipant($request, $conversation);

        $mode = $request->input('mode', 'me');

        // Business chats cannot be cleared for everyone until six months after the last message.
        if ($mode === 'everyone' && $policy->deleteForEveryoneLocked($conversation)) {
            return $this->businessChatLocked($policy, $conversation);
        }

        // A direct chat's history belongs to each person separately, so one person can never
        // clear it for the other. "Clear for everyone" is only for group and community chats.
        if ($mode === 'everyone' && $conversation->type === 'direct') {
            return response()->json([
                'message' => 'You can only clear this chat for yourself. Clearing for everyone is only available in group chats.',
            ], 403);
        }

        if ($mode === 'everyone') {
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

        if ($this->isBlockedInDirectChat($targetConv, $request->user()->id)) {
            return response()->json([
                'message' => 'You cannot message this person. One of you has blocked the other.',
                'code' => 'BLOCKED',
            ], 403);
        }

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
     * Mark conversation as read and broadcast read receipts.
     */
    /** Marks every conversation the user is in as read, in one update. */
    public function readAll(Request $request): JsonResponse
    {
        $user = $request->user();
        $user->forceFill(['last_seen_at' => now()])->saveQuietly();

        ConversationParticipant::where('user_id', $user->id)
            ->update(['last_read_at' => now()]);

        return response()->json(['message' => 'All conversations marked as read.']);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $conversation = $this->resolveConversation($request, $id);
        if (! $conversation) {
            return response()->json(['message' => 'Conversation marked as read.']);
        }
        $this->authorizeParticipant($request, $conversation);

        $user = $request->user();
        $user->forceFill(['last_seen_at' => now()])->saveQuietly();

        ConversationParticipant::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->update(['last_read_at' => now()]);

        $readReceiptsEnabled = (bool) ($user->read_receipts_enabled ?? true);

        if ($readReceiptsEnabled) {
            // Mark all messages from other participants as 'read'
            Message::where('conversation_id', $conversation->id)
                ->where('user_id', '!=', $user->id)
                ->whereIn('status', [Message::STATUS_SENT, Message::STATUS_DELIVERED])
                ->update(['status' => Message::STATUS_READ]);
        }

        // Broadcast real-time read receipt to the conversation and user channels so
        // all participant devices and the reader's other active sessions sync.
        //
        // Only when the reader allows receipts. The setting governs what is
        // disclosed, not merely what is stored: publishing the event regardless
        // would tell every participant exactly when a message was opened by
        // someone who had opted out of being observed doing so.
        if ($readReceiptsEnabled) {
            event(new \App\Events\MessageRead($conversation->id, $user->id));
        }

        return response()->json(['message' => 'Conversation marked as read.']);
    }

    /**
     * Mark message(s) as delivered upon receipt by the other user's client.
     */
    public function markDelivered(Request $request, int $id): JsonResponse
    {
        $conversation = $this->resolveConversation($request, $id);
        if (! $conversation) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        }
        $this->authorizeParticipant($request, $conversation);

        $validated = $request->validate([
            'message_ids' => ['required', 'array'],
            'message_ids.*' => ['integer', 'exists:messages,id'],
        ]);

        $messageIds = $validated['message_ids'];

        // Only mark messages sent by other participants that are currently 'sent'
        $updatedCount = Message::where('conversation_id', $conversation->id)
            ->whereIn('id', $messageIds)
            ->where('user_id', '!=', $request->user()->id)
            ->where('status', Message::STATUS_SENT)
            ->update(['status' => Message::STATUS_DELIVERED]);

        if ($updatedCount > 0) {
            event(new \App\Events\MessageDelivered($conversation->id, $messageIds));
        }

        return response()->json([
            'message' => 'Messages marked as delivered.',
            'count' => $updatedCount,
            'message_ids' => $messageIds,
        ]);
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
    /**
     * Starts a video meeting from a business chat. Either party can start one. The
     * returned link is then sent as a message, so both people see it in the chat.
     */
    public function createMeeting(Request $request, int $id, BusinessChatPolicy $policy): JsonResponse
    {
        $conversation = $this->resolveConversation($request, $id);
        if (! $conversation) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        }
        $this->authorizeParticipant($request, $conversation);

        if (! $policy->isBusiness($conversation)) {
            return response()->json([
                'message' => 'Video meetings are only available in business chats (brand deals or vendor orders).',
                'code' => 'NOT_BUSINESS_CHAT',
            ], 403);
        }

        $user = $request->user();
        $code = Meeting::generateCode();

        Meeting::create([
            'code' => $code,
            'host_user_id' => $user->id,
            'room' => "meeting-{$code}",
            'title' => "{$user->name}'s Meeting",
            'expires_at' => now()->addHours(8),
        ]);

        return response()->json([
            'code' => $code,
            'url' => rtrim((string) config('app.frontend_url'), '/')."/m/{$code}",
        ], 201);
    }

    /** True when either side of a direct chat has blocked the other. */
    private function isBlockedInDirectChat(Conversation $conversation, int $userId): bool
    {
        if ($conversation->type !== 'direct') {
            return false;
        }

        $otherId = $conversation->participants()->where('user_id', '!=', $userId)->value('user_id');
        if (! $otherId) {
            return false;
        }

        return UserBlock::where(function ($q) use ($userId, $otherId) {
            $q->where('blocker_id', $userId)->where('blocked_id', $otherId);
        })->orWhere(function ($q) use ($userId, $otherId) {
            $q->where('blocker_id', $otherId)->where('blocked_id', $userId);
        })->exists();
    }

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
            ->with(['user:id,name,username,avatar_url', 'media', 'edits'])
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
                // Messages have no separate attachment rows: an attachment is
                // either a bare URL or a linked Media record.
                'attachment_url'  => $m->attachment_url,
                'attachment_type' => $m->attachment_type,
                'media'           => $m->media ? [
                    'id'          => $m->media->id,
                    'url'         => $m->media->url,
                    'mime_type'   => $m->media->mime_type,
                    'media_type'  => $m->media->media_type,
                    'original_name' => $m->media->original_name,
                    'expired_at'  => $m->media->expired_at?->toIso8601String(),
                ] : null,
                // An edited message must still show what it originally said, so
                // every revision is retained alongside the current content.
                'edited_at'       => $m->edited_at?->toIso8601String(),
                'edit_count'      => (int) ($m->edit_count ?? 0),
                'edit_history'    => $m->edits->map(fn ($edit) => [
                    'editor_id'         => $edit->editor_id,
                    'previous_content'  => $edit->previous_content,
                    'content'           => $edit->content,
                    'edited_at'         => $edit->created_at?->toIso8601String(),
                ])->values(),
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
