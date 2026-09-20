<?php

namespace Tests\Feature\Accounting;

use App\Models\FeeRule;
use App\Services\Wallet\FeeCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InternationalFeeRulesTest extends TestCase
{
    use RefreshDatabase;

    public function test_airwallex_fee_rules_are_seeded(): void
    {
        $expected = [
            'DEPOSIT_AIRWALLEX_USD', 'DEPOSIT_AIRWALLEX_EUR', 'DEPOSIT_AIRWALLEX_GBP',
            'DEPOSIT_AIRWALLEX_BANK_USD',
            'PAYOUT_AIRWALLEX_USD', 'PAYOUT_AIRWALLEX_EUR', 'PAYOUT_AIRWALLEX_GBP',
        ];

        foreach ($expected as $code) {
            $this->assertSame(1, FeeRule::where('code', $code)->count(), "Missing fee rule {$code}");
        }
    }

    public function test_card_deposit_lookup_applies_usd_rate(): void
    {
        $calc = app(FeeCalculatorService::class);
        $fee = $calc->calculate('DEPOSIT_AIRWALLEX_USD', 10000, 'USD');

        $this->assertSame(320, (int) $fee['fee_amount']); // $2.90 (2.9%) + $0.30
        $this->assertSame('USD', $fee['currency']);
    }

    public function test_payout_lookup_applies_minimum_fee(): void
    {
        $calc = app(FeeCalculatorService::class);
        $fee = $calc->calculate('PAYOUT_AIRWALLEX_USD', 1000, 'USD', null, null, 'creator'); // $10 payout

        $this->assertSame(250, (int) $fee['fee_amount']); // clamped to $2.50 minimum
        $this->assertSame('USD', $fee['currency']);
    }
}