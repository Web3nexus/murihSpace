<?php

namespace Database\Seeders;

use App\Models\FeatureFlag;
use Illuminate\Database\Seeder;

class FeatureFlagSeeder extends Seeder
{
    /**
     * Seed initial feature flags for all platform capabilities.
     */
    public function run(): void
    {
        $flags = [
            [
                'key' => 'brand_deals',
                'label' => 'Brand Deals Marketplace',
                'description' => 'Creator Hub brand deal proposals, campaign milestones, and locked escrow payouts.',
                'enabled' => true,
            ],
            [
                'key' => 'vendor_store',
                'label' => 'Vendor Store & Escrow Orders',
                'description' => 'Physical storefront, product inventory management, escrow orders, and seller payouts.',
                'enabled' => true,
            ],
            [
                'key' => 'ai_assistant',
                'label' => 'Mera AI Assistant & Onboarding',
                'description' => 'Mera AI smart setup wizard, chat suggestions, and interactive AI capabilities.',
                'enabled' => true,
            ],
            [
                'key' => 'calls',
                'label' => 'Audio & Video Calling',
                'description' => 'Direct 1-on-1 audio & video calling engine powered by WebRTC.',
                'enabled' => true,
            ],
            [
                'key' => 'chat_export',
                'label' => 'Chat Backup & Email Export',
                'description' => 'Export conversation history to encrypted email backups.',
                'enabled' => true,
            ],
            [
                'key' => 'link_in_bio',
                'label' => 'Link in Bio Builder',
                'description' => 'Customizable creator landing page, links, and digital product showcase.',
                'enabled' => true,
            ],
            [
                'key' => 'coins_gifting',
                'label' => 'MSH Coins & Content Gifting',
                'description' => 'In-app coins purchasing, post tips, and live stream virtual gifts.',
                'enabled' => true,
            ],
            [
                'key' => 'stories',
                'label' => 'Stories & Status Updates',
                'description' => '24-hour ephemeral image and text status updates.',
                'enabled' => true,
            ],
            [
                'key' => 'communities',
                'label' => 'Communities & Groups',
                'description' => 'Public and private community hubs, chat channels, and membership access.',
                'enabled' => true,
            ],
            [
                'key' => 'kyc_verification',
                'label' => 'KYC Identity Verification',
                'description' => 'Identity verification, Sumsub/Didit integration, and verification badges.',
                'enabled' => true,
            ],
            [
                'key' => 'wallet_withdrawals',
                'label' => 'Wallet Escrow Payouts & Transfers',
                'description' => 'Direct bank withdrawals, peer-to-peer transfers, and escrow balance releases.',
                'enabled' => true,
            ],
        ];

        foreach ($flags as $flagData) {
            FeatureFlag::updateOrCreate(
                ['key' => $flagData['key']],
                [
                    'label' => $flagData['label'],
                    'description' => $flagData['description'],
                    'enabled' => $flagData['enabled'],
                ]
            );
        }
    }
}
