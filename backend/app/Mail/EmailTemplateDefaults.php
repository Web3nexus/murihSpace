<?php

namespace App\Mail;

class EmailTemplateDefaults
{
    /**
     * Default templates, keyed by template key. Values are attributes that
     * can be assigned to an EmailTemplate row.
     */
    public static function all(): array
    {
        return [
            'kyc_approved' => [
                'name' => 'KYC approved',
                'description' => 'Sent when an admin approves a user\'s identity verification.',
                'subject' => 'Your identity verification was approved',
                'body_html' => '<p>Great news — your identity (KYC) verification has been <strong>approved</strong>. You now have full access to payments, withdrawals, and all of your account capabilities.</p>',
            ],
            'kyc_rejected' => [
                'name' => 'KYC rejected',
                'description' => 'Sent when an admin rejects a user\'s identity verification.',
                'subject' => 'Your identity verification needs attention',
                'body_html' => '<p>Thank you for submitting your identity (KYC) documents. Unfortunately, your verification could <strong>not be approved</strong> at this time.</p><p>Reason provided:</p><blockquote style="margin:0; padding:12px 16px; border-left:3px solid #EF4444; background:#FEF2F2; border-radius:8px; color:#4B5563;">{{reason}}</blockquote><p>You can review your details and submit again — we&rsquo;re happy to help if you have questions.</p>',
            ],
            'user_suspended' => [
                'name' => 'Account suspended',
                'description' => 'Sent when an admin suspends a user account.',
                'subject' => 'Your account has been suspended',
                'body_html' => '<p>Your MurihSpace account has been <strong>suspended</strong> while we review your activity. During this time you will not be able to access your account.</p>',
            ],
            'user_reactivated' => [
                'name' => 'Account reactivated',
                'description' => 'Sent when an admin reactivates a suspended account.',
                'subject' => 'Your account has been reactivated',
                'body_html' => '<p>Great news — your MurihSpace account has been <strong>reactivated</strong>. You can sign in and use the platform normally again.</p>',
            ],
            'user_banned' => [
                'name' => 'Account banned',
                'description' => 'Sent when an admin bans a user account.',
                'subject' => 'Your account has been banned',
                'body_html' => '<p>Your MurihSpace account has been <strong>banned</strong> due to a violation of our terms of service. This decision is final.</p>',
            ],
            'admin_role_granted' => [
                'name' => 'Admin role granted',
                'description' => 'Sent when a user is granted an admin role.',
                'subject' => 'Your admin account is ready',
                'body_html' => '<p>You have been granted an <strong>admin role</strong> on the MurihSpace platform ({{role}}). You can now sign in through the Securegate admin portal.</p>',
            ],
            'admin_role_updated' => [
                'name' => 'Admin role updated',
                'description' => 'Sent when an admin\'s role or permissions are changed.',
                'subject' => 'Your admin access was updated',
                'body_html' => '<p>Your admin role and permissions on MurihSpace were recently updated by a super admin. If you did not expect this change, please contact a platform administrator.</p>',
            ],
            'admin_role_removed' => [
                'name' => 'Admin role removed',
                'description' => 'Sent when an admin role is removed.',
                'subject' => 'Your admin access has been removed',
                'body_html' => '<p>Your admin role on the MurihSpace platform has been <strong>removed</strong> by a super admin. You still have a regular member account and can continue using the platform.</p>',
            ],
            'withdrawal_rejected' => [
                'name' => 'Withdrawal rejected',
                'description' => 'Sent when an admin rejects a withdrawal request.',
                'subject' => 'Your withdrawal request was declined',
                'body_html' => '<p>Your withdrawal request of <strong>{{currency}} {{amount}}</strong> was not approved.</p><p><strong>Reason:</strong> {{reason}}</p>',
            ],
            'withdrawal_approved' => [
                'name' => 'Withdrawal approved',
                'description' => 'Sent when a withdrawal is approved and processed.',
                'subject' => 'Your withdrawal has been processed',
                'body_html' => '<p>Your withdrawal of <strong>{{currency}} {{amount}}</strong> has been approved and is being sent to your account. Funds will appear shortly.</p>',
            ],
            'payout_approved' => [
                'name' => 'Gift payout approved',
                'description' => 'Sent when a gift payout request is approved.',
                'subject' => 'Your payout request has been approved',
                'body_html' => '<p>Your payout request of <strong>MSH {{amount}}</strong> has been <strong>approved</strong>. It will be paid out shortly.</p>',
            ],
            'payout_rejected' => [
                'name' => 'Gift payout rejected',
                'description' => 'Sent when a gift payout request is declined.',
                'subject' => 'Your payout request was declined',
                'body_html' => '<p>Your payout request of <strong>MSH {{amount}}</strong> was not approved and the amount has been returned to your wallet.</p>',
            ],
            'payout_paid' => [
                'name' => 'Gift payout paid',
                'description' => 'Sent when a gift payout is marked as paid.',
                'subject' => 'Your payout has been paid',
                'body_html' => '<p>Your payout of <strong>MSH {{amount}}</strong> has been <strong>paid</strong> and is on its way to your account.</p>',
            ],
            'fulfilment_payout_paid' => [
                'name' => 'Fulfilment payout paid',
                'description' => 'Sent when an order fulfilment payout is marked as paid.',
                'subject' => 'Your payout has been paid',
                'body_html' => '<p>Your MurihSpace payout of <strong>{{currency}} {{amount}}</strong> has been <strong>paid</strong> and is on its way to your account.</p>',
            ],
            'welcome' => [
                'name' => 'Welcome',
                'description' => 'Sent to a new member right after they create an account.',
                'subject' => 'Welcome to MurihSpace, {{name}}!',
                'body_html' => '<p>Welcome to MurihSpace, {{name}}! Your account is ready.</p><p>Create your profile, share posts, join communities, and connect with creators and members around the world.</p>',
            ],
            'password_reset' => [
                'name' => 'Password reset',
                'description' => 'Sent when a member requests a password reset link.',
                'subject' => 'Reset your MurihSpace password',
                'body_html' => '<p>Hi {{name}},</p><p>We received a request to reset the password for your MurihSpace account. Click the button below to choose a new password. This link expires in 60 minutes.</p>',
            ],
            'email_verification' => [
                'name' => 'Email verification code',
                'description' => 'Sent when a member needs to verify their email address with a one-time code.',
                'subject' => 'Your MurihSpace verification code',
                'body_html' => '<p>Hi {{name}},</p><p>Your email verification code is:</p><p style="font-size:30px; letter-spacing:8px; font-weight:800; color:#0F172A;">{{code}}</p><p>Enter this code to verify your email and unlock Mera. The code expires in 15 minutes.</p>',
            ],
            'friend_request_received' => [
                'name' => 'Friend request received',
                'description' => 'Sent to a member when someone sends them a friend request.',
                'subject' => '{{from_name}} sent you a friend request',
                'body_html' => '<p>Hi {{name}},</p><p><strong>{{from_name}}</strong> sent you a friend request. Open your friend requests to review it.</p>',
            ],
            'friend_request_accepted' => [
                'name' => 'Friend request accepted',
                'description' => 'Sent to a member when their friend request is accepted.',
                'subject' => '{{from_name}} accepted your friend request',
                'body_html' => '<p>Great news — <strong>{{from_name}}</strong> accepted your friend request. You are now connected on MurihSpace.</p>',
            ],
            'community_join_request' => [
                'name' => 'Community join request',
                'description' => 'Sent to a community creator when a member requests to join.',
                'subject' => '{{from_name}} wants to join {{community}}',
                'body_html' => '<p>Hi {{name}},</p><p><strong>{{from_name}}</strong> has requested to join your community <strong>{{community}}</strong>. Review the request to approve or reject it.</p>',
            ],
            'community_join_approved' => [
                'name' => 'Community join approved',
                'description' => 'Sent to a member when their request to join a community is approved.',
                'subject' => 'You have been accepted into {{community}}',
                'body_html' => '<p>Your request to join <strong>{{community}}</strong> has been <strong>approved</strong>. Welcome aboard!</p>',
            ],
            'community_join_rejected' => [
                'name' => 'Community join rejected',
                'description' => 'Sent to a member when their request to join a community is rejected.',
                'subject' => 'Your request to join {{community}} was declined',
                'body_html' => '<p>Thank you for your interest in <strong>{{community}}</strong>. Unfortunately, your join request was <strong>not approved</strong> at this time.</p>',
            ],
            'community_role_updated' => [
                'name' => 'Community role updated',
                'description' => 'Sent to a member when their role in a community changes.',
                'subject' => 'Your role in {{community}} was updated',
                'body_html' => '<p>Your role in the community <strong>{{community}}</strong> has been updated to <strong>{{role}}</strong> by the community owner.</p>',
            ],
            'donation_received' => [
                'name' => 'Donation received',
                'description' => 'Sent to a creator when they receive a donation.',
                'subject' => 'You received a donation of {{currency}} {{amount}}',
                'body_html' => '<p>You received a donation of <strong>{{currency}} {{amount}}</strong> from {{from_name}}.</p>',
            ],
            'content_removed' => [
                'name' => 'Content removed',
                'description' => 'Sent to a member when one of their posts or comments is removed by moderation.',
                'subject' => 'Your {{content_type}} was removed',
                'body_html' => '<p>Your {{content_type}} on MurihSpace was <strong>removed</strong> because it did not comply with our community guidelines.</p>',
            ],
        ];
    }

    public static function get(string $key): ?array
    {
        return self::all()[$key] ?? null;
    }
}
