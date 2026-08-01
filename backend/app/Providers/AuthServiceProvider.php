<?php

namespace App\Providers;

use App\Models\AudioRoom;
use App\Models\AuditLog;
use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\CommunityRole;
use App\Models\Conversation;
use App\Models\DigitalProduct;
use App\Models\Donation;
use App\Models\Event;
use App\Models\FeatureFlag;
use App\Models\Message;
use App\Models\Notification;
use App\Models\Order;
use App\Models\PageSection;
use App\Models\Post;
use App\Models\Purchase;
use App\Models\Report;
use App\Models\Storefront;
use App\Models\Transfer;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Policies\AudioRoomPolicy;
use App\Policies\AuditLogPolicy;
use App\Policies\CommunityMembershipPolicy;
use App\Policies\CommunityPolicy;
use App\Policies\CommunityRolePolicy;
use App\Policies\ConversationPolicy;
use App\Policies\DigitalProductPolicy;
use App\Policies\DonationPolicy;
use App\Policies\EventPolicy;
use App\Policies\FeatureFlagPolicy;
use App\Policies\MessagePolicy;
use App\Policies\NotificationPolicy;
use App\Policies\OrderPolicy;
use App\Policies\PageSectionPolicy;
use App\Policies\PostPolicy;
use App\Policies\PurchasePolicy;
use App\Policies\ReportPolicy;
use App\Policies\StorefrontPolicy;
use App\Policies\TransferPolicy;
use App\Policies\UserPolicy;
use App\Policies\WalletPolicy;
use App\Policies\WithdrawalRequestPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        AudioRoom::class => AudioRoomPolicy::class,
        AuditLog::class => AuditLogPolicy::class,
        Community::class => CommunityPolicy::class,
        CommunityMembership::class => CommunityMembershipPolicy::class,
        CommunityRole::class => CommunityRolePolicy::class,
        Conversation::class => ConversationPolicy::class,
        DigitalProduct::class => DigitalProductPolicy::class,
        Donation::class => DonationPolicy::class,
        Event::class => EventPolicy::class,
        FeatureFlag::class => FeatureFlagPolicy::class,
        Message::class => MessagePolicy::class,
        Notification::class => NotificationPolicy::class,
        Order::class => OrderPolicy::class,
        PageSection::class => PageSectionPolicy::class,
        Post::class => PostPolicy::class,
        Purchase::class => PurchasePolicy::class,
        Report::class => ReportPolicy::class,
        Storefront::class => StorefrontPolicy::class,
        Transfer::class => TransferPolicy::class,
        User::class => UserPolicy::class,
        Wallet::class => WalletPolicy::class,
        WithdrawalRequest::class => WithdrawalRequestPolicy::class,
    ];

    public function boot(): void
    {
        $this->registerPolicies();
    }
}
