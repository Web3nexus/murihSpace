<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\E2eeSenderKeyEnvelope;
use Illuminate\Support\Facades\DB;

/**
 * Epoch rules for end-to-end encrypted group chats.
 *
 * Any change to a group's membership moves it to a new key epoch. Senders must then
 * create new sender keys and distribute them again, and the server refuses group
 * messages made under an older epoch. See docs/e2ee-groups.md.
 */
class E2eeGroupService
{
    public const ENCRYPTION = 'signal_group_v1';

    /** Largest group that can be encrypted. Distribution is one envelope per member pair. */
    public const MAX_MEMBERS = 256;

    public function supports(Conversation $conversation): bool
    {
        return $conversation->type === 'group';
    }

    /**
     * Moves a group to a new key epoch and drops the envelopes of the old one.
     * Call this after every membership change of a group conversation.
     */
    public function bumpEpoch(Conversation $conversation): int
    {
        return DB::transaction(function () use ($conversation) {
            $locked = Conversation::whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            $locked->forceFill(['e2ee_epoch' => $locked->e2ee_epoch + 1])->saveQuietly();
            E2eeSenderKeyEnvelope::where('conversation_id', $locked->id)->delete();

            $conversation->e2ee_epoch = $locked->e2ee_epoch;

            return $locked->e2ee_epoch;
        });
    }
}
