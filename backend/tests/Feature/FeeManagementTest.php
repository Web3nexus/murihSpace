<?php

namespace Tests\Feature;

use App\Models\FeeRule;
use App\Models\User;
use App\Services\Wallet\FeeCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeeManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_fee_calculator_service_computes_percentage_and_caps(): void
    {
        FeeRule::create([
            'name'        => 'Test Deposit Fee',
            'code'        => 'TEST_DEPOSIT',
            'fee_type'    => 'percentage',
            'percentage'  => 2.00, // 2%
            'minimum_fee' => 1000, // min ₦10.00
            'maximum_fee' => 50000, // max ₦500.00
            'currency'    => 'NGN',
            'enabled'     => true,
            'priority'    => 10,
        ]);

        $service = new FeeCalculatorService();

        // 2% of ₦1,000.00 (100000 kobo) = 2000 kobo
        $res1 = $service->calculate('TEST_DEPOSIT', 100000);
        $this->assertEquals(2000, $res1['fee_amount']);
        $this->assertEquals(98000, $res1['net_amount']);

        // Minimum cap: 2% of ₦100.00 (10000 kobo) = 200 kobo < min 1000 kobo → 1000 kobo
        $res2 = $service->calculate('TEST_DEPOSIT', 10000);
        $this->assertEquals(1000, $res2['fee_amount']);

        // Maximum cap: 2% of ₦100,000.00 (10000000 kobo) = 200000 > max 50000 → 50000
        $res3 = $service->calculate('TEST_DEPOSIT', 10000000);
        $this->assertEquals(50000, $res3['fee_amount']);
    }

    public function test_user_can_request_pre_flight_fee_preview(): void
    {
        FeeRule::create([
            'name'         => 'Transfer Fee',
            'code'         => 'TEST_INTERNAL_TRANSFER',
            'fee_type'     => 'fixed_plus_percentage',
            'fixed_amount' => 5000, // ₦50.00
            'percentage'   => 1.00,  // 1%
            'minimum_fee'  => 5000,
            'currency'     => 'NGN',
            'enabled'      => true,
            'priority'     => 10,
        ]);

        $user = User::factory()->create(['role' => 'creator']);

        $response = $this->actingAs($user)->postJson('/api/v1/wallet/fees/preview', [
            'transaction_code' => 'TEST_INTERNAL_TRANSFER',
            'amount'           => 500000, // ₦5,000.00
            'currency'         => 'NGN',
        ]);

        $response->assertStatus(200);

        // Response is enveloped: { success, data: { data: { gross_amount, ... } } }
        $payload = $response->json('data.data');
        $this->assertEquals(500000, $payload['gross_amount']);
        $this->assertEquals(10000, $payload['platform_fee']); // ₦50 fixed + 1% of ₦5000 = ₦50 + ₦50 = ₦100 → 10000 kobo
        $this->assertEquals(490000, $payload['net_amount']);
    }

    public function test_admin_can_manage_fee_rules(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'admin_role' => 'super_admin']);

        // Create
        $createRes = $this->actingAs($admin)->postJson('/api/v1/securegate/fees', [
            'name'             => 'Withdrawal Fee',
            'code'             => 'WITHDRAWAL_BANK',
            'fee_type'         => 'fixed',
            'fixed_amount'     => 5000,
            'transaction_type' => 'withdrawal',
            'enabled'          => true,
        ]);

        $createRes->assertStatus(201);
        $ruleId = $createRes->json('data.data.id');
        $this->assertNotNull($ruleId, 'Fee rule ID should be present in response');

        // Toggle status
        $toggleRes = $this->actingAs($admin)->postJson("/api/v1/securegate/fees/{$ruleId}/toggle");
        $toggleRes->assertStatus(200);
        $this->assertFalse($toggleRes->json('data.data.enabled'));

        // Delete
        $deleteRes = $this->actingAs($admin)->deleteJson("/api/v1/securegate/fees/{$ruleId}");
        $deleteRes->assertStatus(200);

        $this->assertDatabaseMissing('fee_rules', ['id' => $ruleId]);
    }
}
