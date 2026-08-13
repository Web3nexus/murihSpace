<?php

namespace Database\Seeders;

use App\Models\SupportTeam;
use Illuminate\Database\Seeder;

class SupportTeamSeeder extends Seeder
{
    public function run(): void
    {
        foreach (SupportTeam::DEFAULT_TEAMS as $index => $name) {
            SupportTeam::query()->firstOrCreate(
                ['name' => $name],
                [
                    'description' => $this->descriptionFor($name),
                    'is_active' => true,
                    'sort_order' => $index,
                ],
            );
        }
    }

    protected function descriptionFor(string $name): ?string
    {
        return [
            'General Support' => 'Day-to-day customer questions across MurihSpace.',
            'Technical Support' => 'Bugs, errors and technical troubleshooting.',
            'Billing' => 'Invoices, refunds and payment issues.',
            'Wallet & Payments' => 'Wallet balance, deposits and withdrawals.',
            'KYC' => 'Identity verification and re-verification.',
            'Creators' => 'Creator accounts, payouts and content tools.',
            'Vendors' => 'Vendor onboarding and store operations.',
            'Store & Orders' => 'Orders, fulfilment and delivery.',
            'Community Safety' => 'Abuse reports and community guidelines.',
            'Conference Support' => 'Conference registrations and live event help.',
        ][$name] ?? null;
    }
}
