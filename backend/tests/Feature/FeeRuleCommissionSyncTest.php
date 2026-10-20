<?php

namespace Tests\Feature;

use App\Models\AdminSetting;
use App\Models\AuditLog;
use App\Models\FeeRule;
use App\Models\User;
use App\Services\Commission\CommissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * The fee rules page edits the same commission settings CommissionService reads.
 */
class FeeRuleCommissionSyncTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function admin(): User
    {
        return User::factory()->create(['role' => 'admin', 'admin_role' => 'super_admin']);
    }

    private function commission(): CommissionService
    {
        return app(CommissionService::class);
    }

    public function test_an_admin_fee_rule_update_changes_the_rate_charged_at_checkout(): void
    {
        Cache::flush();
        $admin = $this->admin();

        $rule = FeeRule::create([
            'name' => 'Digital Product Buyer Fee',
            'code' => 'DIGITAL_BUYER_FEE',
            'fee_type' => 'percentage',
            'percentage' => 5,
            'enabled' => true,
            'priority' => 10,
        ]);

        // Warm the cache with the old rate, as checkout would.
        $this->assertSame(5.0, $this->commission()->calculateFee(100, 'digital_buyer'));

        $this->actingAsSession($admin)->putJson("/api/v1/securegate/fees/{$rule->id}", [
            'percentage' => 8,
        ])->assertOk();

        // The checkout fee (CheckoutController uses calculateFee(subtotal, 'digital_buyer')) follows the rule.
        $this->assertSame(8.0, $this->commission()->calculateFee(100, 'digital_buyer'));
        $this->assertSame('8', AdminSetting::get('commission_percentage_digital_buyer'));

        $audit = AuditLog::where('action', 'commission.updated')->where('resource_type', 'fee_rule')->first();
        $this->assertNotNull($audit);
        $this->assertSame($admin->id, $audit->user_id);
        $this->assertSame('digital_buyer', $audit->metadata['commission_type']);
        $this->assertEquals(8.0, $audit->metadata['new_percentage']);
    }

    public function test_creating_a_commission_fee_rule_writes_the_setting_in_the_same_step(): void
    {
        Cache::flush();

        $this->actingAsSession($this->admin())->postJson('/api/v1/securegate/fees', [
            'name' => 'Coin Pack Transaction Fee',
            'code' => 'COIN_PURCHASE_FEE',
            'fee_type' => 'percentage',
            'percentage' => 6.5,
        ])->assertCreated();

        $this->assertSame('6.5', AdminSetting::get('commission_percentage_coin_purchase'));
        $this->assertSame(6.5, $this->commission()->getCommissionPercentage('coin_purchase'));
    }

    public function test_a_stale_fee_rule_row_cannot_override_the_settings(): void
    {
        Cache::flush();

        // A stale commission row with a different value than the setting.
        FeeRule::create([
            'name' => 'Stale seller fee',
            'code' => 'DIGITAL_COMMERCE_FEE',
            'fee_type' => 'percentage',
            'percentage' => 50,
            'enabled' => true,
            'priority' => 10,
        ]);
        AdminSetting::set('commission_percentage_digital', 12);

        $this->assertSame(12.0, $this->commission()->getCommissionPercentage('digital'));

        // With no setting at all, the stale row is ignored in favour of the schedule default.
        AdminSetting::query()->where('key', 'commission_percentage_digital')->delete();
        Cache::flush();

        $this->assertSame(20.0, $this->commission()->getCommissionPercentage('digital'));
    }

    public function test_a_commission_rule_must_be_a_percentage_and_cannot_be_disabled_or_deleted(): void
    {
        $admin = $this->admin();

        $this->actingAsSession($admin)->postJson('/api/v1/securegate/fees', [
            'name' => 'Gift fee',
            'code' => 'GIFT_FEE',
            'fee_type' => 'fixed',
            'fixed_amount' => 100,
        ])->assertUnprocessable();

        $rule = FeeRule::create([
            'name' => 'Gift fee',
            'code' => 'GIFT_FEE',
            'fee_type' => 'percentage',
            'percentage' => 15,
            'enabled' => true,
            'priority' => 10,
        ]);

        $this->actingAsSession($admin)->postJson("/api/v1/securegate/fees/{$rule->id}/toggle")->assertUnprocessable();
        $this->actingAsSession($admin)->deleteJson("/api/v1/securegate/fees/{$rule->id}")->assertUnprocessable();
        $this->assertDatabaseHas('fee_rules', ['id' => $rule->id]);
    }

    public function test_the_first_deploy_seed_copies_rule_values_without_overwriting_a_setting(): void
    {
        Cache::flush();
        AdminSetting::set('commission_percentage_coin_purchase', 3);

        FeeRule::create([
            'name' => 'Buyer fee',
            'code' => 'DIGITAL_BUYER_FEE',
            'fee_type' => 'percentage',
            'percentage' => 9,
            'enabled' => true,
            'priority' => 10,
        ]);
        FeeRule::create([
            'name' => 'Coin fee',
            'code' => 'COIN_PURCHASE_FEE',
            'fee_type' => 'percentage',
            'percentage' => 6,
            'enabled' => true,
            'priority' => 10,
        ]);
        FeeRule::create([
            'name' => 'Withdrawal fee',
            'code' => 'WITHDRAWAL_BANK',
            'fee_type' => 'fixed',
            'fixed_amount' => 5000,
            'enabled' => true,
            'priority' => 10,
        ]);

        $seed = require database_path('migrations/2026_10_19_180000_seed_commission_settings_from_fee_rules.php');
        $seed->up();

        // Copied: no setting existed for digital_buyer.
        $this->assertSame('9', AdminSetting::get('commission_percentage_digital_buyer'));
        $this->assertSame(9.0, $this->commission()->getCommissionPercentage('digital_buyer'));

        // Not overwritten: the admin's saved setting wins over the rule.
        $this->assertSame('3', AdminSetting::get('commission_percentage_coin_purchase'));

        // Not a commission rule, so no setting is created for it.
        $this->assertNull(AdminSetting::get('commission_percentage_withdrawal_bank'));

        // The copy is audited.
        $this->assertTrue(AuditLog::where('metadata->source', 'fee_rule_seed')->where('metadata->commission_type', 'digital_buyer')->exists());
    }
}
