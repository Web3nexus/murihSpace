<?php

namespace App\Services\Chat;

use App\Models\BrandDeal;
use App\Models\BrandDealProposal;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Order;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Business chats keep their history for both parties.
 *
 * A chat is business when it is a marketplace chat, or a direct chat between two people who have
 * (or had) an escrow, a vendor order, or a brand deal together. While it is business and has had a message in the last six months,
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

        [$a, $b] = $participantIds->values()->map(fn ($id) => (int) $id)->all();

        // Any escrow between the two people counts, whatever its status: the relationship is commercial.
        $escrow = DB::table('escrows')
            ->whereIn('buyer_id', $participantIds)
            ->whereIn('seller_id', $participantIds)
            ->exists();

        return $escrow
            || $this->vendorOrderBetween($a, $b)
            || $this->brandDealBetween($a, $b)
            || $this->brandDealBetween($b, $a);
    }

    /**
     * The counterparts in $otherIds who share a business relationship with $userId, using the same
     * rules as isBusiness() but a fixed number of queries. Used when listing many conversations.
     *
     * @param  array<int, int>  $otherIds
     * @return array<int, int>  the subset of $otherIds that is business
     */
    public function businessCounterparts(int $userId, array $otherIds): array
    {
        if ($otherIds === []) {
            return [];
        }

        $found = [];

        $escrowed = DB::table('escrows')->where('buyer_id', $userId)->whereIn('seller_id', $otherIds)->pluck('seller_id')
            ->merge(DB::table('escrows')->where('seller_id', $userId)->whereIn('buyer_id', $otherIds)->pluck('buyer_id'));
        $ordered = Order::where('buyer_id', $userId)->whereIn('creator_id', $otherIds)->pluck('creator_id')
            ->merge(Order::where('creator_id', $userId)->whereIn('buyer_id', $otherIds)->pluck('buyer_id'));

        foreach ($escrowed->merge($ordered) as $id) {
            $found[(int) $id] = true;
        }

        $emails = User::whereIn('id', $otherIds)->pluck('email', 'id');
        $me = strtolower((string) User::whereKey($userId)->value('email'));

        // Brand deals and proposals in either direction, matched on the brand contact email.
        $brandContactsOfMe = $this->brandEmailsBy([$userId]);
        foreach ($emails as $otherId => $email) {
            if ($email && in_array(strtolower($email), $brandContactsOfMe, true)) {
                $found[(int) $otherId] = true;
            }
        }

        if ($me !== '') {
            $creatorsWhoBrandedMe = $this->brandEmailsByCreator($otherIds, $me);
            foreach ($creatorsWhoBrandedMe as $creatorId) {
                $found[(int) $creatorId] = true;
            }
        }

        return array_values(array_filter($otherIds, fn (int $id) => isset($found[$id])));
    }

    /** Lower-cased brand contact emails from deals and proposals created by these users. */
    private function brandEmailsBy(array $creatorIds): array
    {
        $deals = BrandDeal::whereIn('creator_id', $creatorIds)->with('brand:id,contact_email')->get()
            ->map(fn (BrandDeal $deal) => strtolower((string) $deal->brand?->contact_email));
        $proposals = BrandDealProposal::whereIn('creator_id', $creatorIds)->pluck('brand_email')
            ->map(fn ($email) => strtolower((string) $email));

        return $deals->merge($proposals)->filter()->unique()->values()->all();
    }

    /** Creator ids (from $creatorIds) whose deal or proposal names $contactEmail as the brand contact. */
    private function brandEmailsByCreator(array $creatorIds, string $contactEmail): array
    {
        $fromDeals = BrandDeal::whereIn('creator_id', $creatorIds)
            ->whereHas('brand', fn ($q) => $q->whereRaw('LOWER(contact_email) = ?', [$contactEmail]))
            ->pluck('creator_id');
        $fromProposals = BrandDealProposal::whereIn('creator_id', $creatorIds)
            ->whereRaw('LOWER(brand_email) = ?', [$contactEmail])
            ->pluck('creator_id');

        return $fromDeals->merge($fromProposals)->map(fn ($id) => (int) $id)->unique()->values()->all();
    }

    /** A vendor order between the two people, in either direction. */
    private function vendorOrderBetween(int $a, int $b): bool
    {
        return Order::where(fn ($q) => $q->where('buyer_id', $a)->where('creator_id', $b))
            ->orWhere(fn ($q) => $q->where('buyer_id', $b)->where('creator_id', $a))
            ->exists();
    }

    /** True when $creatorId has a brand deal or proposal whose brand contact is $otherId's email. */
    private function brandDealBetween(int $creatorId, int $otherId): bool
    {
        $email = User::whereKey($otherId)->value('email');
        if (! $email) {
            return false;
        }

        $email = strtolower($email);

        $viaDeal = BrandDeal::where('creator_id', $creatorId)
            ->whereHas('brand', fn ($q) => $q->whereRaw('LOWER(contact_email) = ?', [$email]))
            ->exists();

        $viaProposal = BrandDealProposal::where('creator_id', $creatorId)
            ->whereRaw('LOWER(brand_email) = ?', [$email])
            ->exists();

        return $viaDeal || $viaProposal;
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
