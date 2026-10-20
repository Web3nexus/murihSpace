<?php

namespace App\Services\Chat;

use App\Models\Conversation;
use App\Models\Message;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Business chats keep their history for both parties.
 *
 * A chat is business when it is a marketplace chat, or a direct chat between two people who have
 * (or had) an escrow together. While it is business and has had a message in the last six months,
 * neither party can delete messages for everyone. Once six months pass with no new message, the
 * normal delete-for-everyone rules apply again. Deleting for yourself is always allowed, because it
 * does not remove anything from the other party's view.
 */
class BusinessChatPolicy
{
    public const INACTIVITY_MONTHS = 6;

    public const LOCKED_MESSAGE = 'Business chats cannot be deleted for everyone while the conversation is active. '
        .'Deleting opens six months after the last message.';

    public function isBusiness(Conversation $conversation): bool
    {
        if ($conversation->type === 'marketplace') {
            return true;
        }

        if ($conversation->type !== 'direct') {
            return false;
        }

        $participantIds = $conversation->participants()->pluck('user_id');
        if ($participantIds->count() !== 2) {
            return false;
        }

        // Any escrow between the two people counts, whatever its status: the relationship is commercial.
        return DB::table('escrows')
            ->whereIn('buyer_id', $participantIds)
            ->whereIn('seller_id', $participantIds)
            ->exists();
    }

    /** The time of the last message, or the chat's creation time when it has none. */
    public function lastActivityAt(Conversation $conversation): Carbon
    {
        $last = Message::where('conversation_id', $conversation->id)->max('created_at');

        return $last ? Carbon::parse($last) : Carbon::parse($conversation->created_at);
    }

    /** When delete-for-everyone opens again, or null when it is open now. */
    public function unlocksAt(Conversation $conversation): ?Carbon
    {
        if (! $this->isBusiness($conversation)) {
            return null;
        }

        $unlocksAt = $this->lastActivityAt($conversation)->addMonths(self::INACTIVITY_MONTHS);

        return $unlocksAt->isFuture() ? $unlocksAt : null;
    }

    public function deleteForEveryoneLocked(Conversation $conversation): bool
    {
        return $this->unlocksAt($conversation) !== null;
    }
}
