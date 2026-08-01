<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;

class ActivityLogger
{
    public function log(
        User $user,
        string $type,
        string $description,
        ?string $referenceType = null,
        ?int $referenceId = null,
        ?array $metadata = null,
    ): ActivityLog {
        return ActivityLog::create([
            'user_id' => $user->id,
            'type' => $type,
            'description' => $description,
            'reference_type' => $referenceType,
            'reference_id' => $referenceId,
            'metadata' => $metadata,
        ]);
    }

    public function createdPost(User $user, string $communityName, int $postId): ActivityLog
    {
        return $this->log($user, 'post.created', "Posted in {$communityName}", 'post', $postId);
    }

    public function joinedCommunity(User $user, string $communityName, int $communityId): ActivityLog
    {
        return $this->log($user, 'community.joined', "Joined {$communityName}", 'community', $communityId);
    }

    public function madePurchase(User $user, string $productName, int $orderId, int $amount): ActivityLog
    {
        return $this->log($user, 'purchase.completed', "Purchased {$productName}", 'order', $orderId, ['amount' => $amount]);
    }

    public function withdrawn(User $user, int $amount, string $currency): ActivityLog
    {
        return $this->log($user, 'withdrawal.requested', "Withdrawal of {$amount} {$currency} requested", null, null, ['amount' => $amount, 'currency' => $currency]);
    }

    public function donationSent(User $user, string $recipientName, int $amount, string $currency): ActivityLog
    {
        return $this->log($user, 'donation.sent', "Donated {$amount} {$currency} to {$recipientName}", null, null, ['amount' => $amount, 'currency' => $currency]);
    }

    public function eventRegistered(User $user, string $eventName, int $eventId): ActivityLog
    {
        return $this->log($user, 'event.registered', "Registered for {$eventName}", 'event', $eventId);
    }

    public function subscriptionStarted(User $user, string $creatorName, int $subscriptionId): ActivityLog
    {
        return $this->log($user, 'subscription.started', "Subscribed to {$creatorName}", 'subscription', $subscriptionId);
    }

    public function publishedPost(User $user, string $communityName, int $postId): ActivityLog
    {
        return $this->log($user, 'post.published', "Published a post in {$communityName}", 'post', $postId);
    }
}
