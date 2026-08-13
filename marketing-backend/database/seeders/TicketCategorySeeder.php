<?php

namespace Database\Seeders;

use App\Models\TicketCategory;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class TicketCategorySeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the ticket category tree (idempotent).
     */
    public function run(): void
    {
        $categories = [
            ['slug' => 'account', 'name' => 'Account & Login', 'description' => 'Sign-in, verification and profile issues', 'children' => [
                ['slug' => 'account.login', 'name' => 'Login issues'],
                ['slug' => 'account.verification', 'name' => 'Email / identity verification'],
                ['slug' => 'account.profile', 'name' => 'Profile settings'],
            ]],
            ['slug' => 'payments', 'name' => 'Payments & Billing', 'description' => 'Invoices, refunds and transactions', 'children' => [
                ['slug' => 'payments.billing', 'name' => 'Invoices & billing'],
                ['slug' => 'payments.refunds', 'name' => 'Refunds'],
                ['slug' => 'payments.transactions', 'name' => 'Failed or pending transactions'],
            ]],
            ['slug' => 'communities', 'name' => 'Communities', 'description' => 'Community membership and moderation', 'children' => [
                ['slug' => 'communities.membership', 'name' => 'Membership'],
                ['slug' => 'communities.moderation', 'name' => 'Reporting & moderation'],
            ]],
            ['slug' => 'conferences', 'name' => 'Conferences', 'description' => 'Events, streaming and registration', 'children' => [
                ['slug' => 'conferences.registration', 'name' => 'Registration'],
                ['slug' => 'conferences.streaming', 'name' => 'Live streaming issues'],
            ]],
            ['slug' => 'gifting', 'name' => 'Gifting', 'description' => 'Gift cards and gifting', 'children' => []],
            ['slug' => 'security', 'name' => 'Security & KYC', 'description' => 'Account security and KYC checks', 'children' => [
                ['slug' => 'security.kyc', 'name' => 'KYC verification'],
                ['slug' => 'security.suspicious', 'name' => 'Suspicious activity'],
            ]],
            ['slug' => 'technical', 'name' => 'Technical Support', 'description' => 'Bugs and platform issues', 'children' => [
                ['slug' => 'technical.app', 'name' => 'Mobile / desktop app'],
                ['slug' => 'technical.web', 'name' => 'Website'],
            ]],
            ['slug' => 'other', 'name' => 'Other', 'description' => 'Anything else', 'children' => []],
        ];

        $sort = 0;
        foreach ($categories as $category) {
            $parent = TicketCategory::firstOrCreate(
                ['slug' => $category['slug']],
                [
                    'name' => $category['name'],
                    'description' => $category['description'],
                    'sort_order' => $sort++,
                    'is_active' => true,
                ]
            );

            foreach ($category['children'] as $child) {
                TicketCategory::firstOrCreate(
                    ['slug' => $child['slug']],
                    [
                        'parent_id' => $parent->id,
                        'name' => $child['name'],
                        'sort_order' => $sort++,
                        'is_active' => true,
                    ]
                );
            }
        }
    }
}
