<?php

namespace Tests\Feature\Accounting;

use App\Models\PaymentProvider;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountantRbacSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected User $accountant;

    protected User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        // 1. Accountant / Financial Auditor (role: admin, admin_role: finance_admin)
        $this->accountant = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'finance_admin',
            'admin_permissions' => ['accounting', 'tax'],
        ]);

        // 2. Platform Owner / Super Admin
        $this->superAdmin = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'super_admin',
            'admin_permissions' => [],
        ]);

        PaymentProvider::create([
            'code' => 'airwallex',
            'name' => 'Airwallex',
            'is_enabled' => true,
            'environment' => 'sandbox',
            'priority' => 1,
            'health_status' => 'healthy',
            'supported_methods' => ['card'],
        ]);
    }

    public function test_accountant_can_access_accounting_and_tax_endpoints(): void
    {
        // 1. Accounting Overview
        $resOverview = $this->actingAs($this->accountant)->getJson('/api/v1/securegate/accounting/overview');
        $resOverview->assertStatus(200);
        $resOverview->assertJsonStructure(['data' => ['metrics', 'summary']]);

        // 2. Tax Summary
        $resTax = $this->actingAs($this->accountant)->getJson('/api/v1/securegate/tax/summary');
        $resTax->assertStatus(200);
        $resTax->assertJsonStructure(['data' => ['totals', 'liabilities']]);

        // 3. Tax Rates
        $resRates = $this->actingAs($this->accountant)->getJson('/api/v1/securegate/tax/rates');
        $resRates->assertStatus(200);
    }

    public function test_accountant_is_strictly_forbidden_from_payment_gateway_infrastructure(): void
    {
        // Gateway list
        $resList = $this->actingAs($this->accountant)->getJson('/api/v1/securegate/payment-providers');
        $resList->assertStatus(403);

        // Gateway update
        $resUpdate = $this->actingAs($this->accountant)->putJson('/api/v1/securegate/payment-providers/airwallex', [
            'is_enabled' => false,
            'reason' => 'Unauthorized attempt by accountant',
        ]);
        $resUpdate->assertStatus(403);
    }

    public function test_accountant_is_strictly_forbidden_from_processing_withdrawals(): void
    {
        $creator = User::factory()->create(['role' => 'creator']);
        $withdrawal = WithdrawalRequest::create([
            'user_id' => $creator->id,
            'amount' => 50000,
            'currency' => 'NGN',
            'status' => 'pending',
            'wallet_type' => 'creator',
        ]);

        $response = $this->actingAs($this->accountant)->postJson("/api/v1/securegate/withdrawals/{$withdrawal->id}/process", [
            'action' => 'approve',
        ]);

        $response->assertStatus(403);
        $this->assertEquals('pending', $withdrawal->fresh()->status);
    }

    public function test_accountant_is_strictly_forbidden_from_manually_adjusting_wallets(): void
    {
        $member = User::factory()->create(['role' => 'member']);
        $wallet = Wallet::create([
            'user_id' => $member->id,
            'wallet_type' => 'system',
            'currency' => 'USD',
            'available' => 10000,
        ]);

        $response = $this->actingAs($this->accountant)->postJson("/api/v1/securegate/wallets/{$wallet->id}/adjust", [
            'action' => 'credit',
            'balance_category' => 'available',
            'amount' => 5000,
            'reason' => 'Unauthorized accountant credit',
        ]);

        $response->assertStatus(403);
        $this->assertEquals(10000, $wallet->fresh()->available);
    }

    public function test_super_admin_has_full_access_to_gateways(): void
    {
        $response = $this->actingAs($this->superAdmin)->getJson('/api/v1/securegate/payment-providers');
        $response->assertStatus(200);
    }

    public function test_admin_without_accounting_permission_is_forbidden_from_accounting_and_tax(): void
    {
        $moderator = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'moderator',
            'admin_permissions' => ['community_mod'],
        ]);

        $resOverview = $this->actingAs($moderator)->getJson('/api/v1/securegate/accounting/overview');
        $resOverview->assertStatus(403);

        $resTax = $this->actingAs($moderator)->getJson('/api/v1/securegate/tax/summary');
        $resTax->assertStatus(403);
    }
}
