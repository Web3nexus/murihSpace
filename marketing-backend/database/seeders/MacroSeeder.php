<?php

namespace Database\Seeders;

use App\Models\Macro;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class MacroSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed a set of default canned replies (idempotent).
     */
    public function run(): void
    {
        $macros = [
            [
                'name' => 'We’re on it',
                'category' => 'General',
                'body' => "Hi {name},\n\nThanks for reaching out. We’ve received your request and a member of our support team is looking into it. We’ll get back to you as soon as we have an update.\n\nBest regards,\nThe MurihSpace Support Team",
            ],
            [
                'name' => 'Issue resolved — confirmation',
                'category' => 'General',
                'body' => "Hi {name},\n\nGreat news — we’ve resolved your issue. Please take a moment to confirm everything is working as expected, and let us know if you need anything else.\n\nBest regards,\nThe MurihSpace Support Team",
            ],
            [
                'name' => 'Payment confirmed',
                'category' => 'Payments',
                'body' => "Hi {name},\n\nWe can confirm your payment of {amount} on {date} went through successfully. Your transaction reference is {reference}.\n\nIf you have any further questions, just reply to this ticket.",
            ],
            [
                'name' => 'Refund request received',
                'category' => 'Payments',
                'body' => "Hi {name},\n\nThanks for letting us know. We’ve received your refund request and it’s now being processed. Refunds typically take 5–10 business days to appear on your statement.\n\nBest regards,\nThe MurihSpace Support Team",
            ],
            [
                'name' => 'Verification in progress',
                'category' => 'KYC',
                'body' => "Hi {name},\n\nYour verification documents have been received and are currently under review. This usually takes up to 48 hours. We’ll notify you as soon as your account is verified.",
            ],
        ];

        foreach ($macros as $macro) {
            Macro::firstOrCreate(
                ['name' => $macro['name']],
                [
                    'category' => $macro['category'],
                    'body' => $macro['body'],
                    'is_active' => true,
                ]
            );
        }
    }
}
