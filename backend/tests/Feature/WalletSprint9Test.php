<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WalletSprint9Test extends TestCase
{
    use RefreshDatabase;

    public function test_wallets_are_auto_provisioned_per_role(): void
    {
        $user = User::factory()->create(['role' => 'creator']);
        $walletService = new WalletService();
        $wallets = $walletService->getUserWallets($user);

        $this->assertCount(3, $wallets); // System, Creator, Business
        $this->assertTrue($wallets->contains('wallet_type', 'system'));
        $this->assertTrue($wallets->contains('wallet_type', 'creator'));
        $this->assertTrue($wallets->contains('wallet_type', 'business'));
    }

    public function test_user_can_deposit_into_system_wallet(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        $response = $this->actingAs($user)->postJson('/api/v1/wallet/deposit', [
            'amount'          => 500000, // ₦5,000.00
            'payment_gateway' => 'paystack',
            'idempotency_key' => 'DEP-TEST-001',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('message', 'Deposit successful.');

        $systemWallet = Wallet::where('user_id', $user->id)->where('wallet_type', 'system')->first();
        $this->assertNotNull($systemWallet);
        $this->assertGreaterThan(0, $systemWallet->available);
    }

    public function test_duplicate_deposit_with_same_idempotency_key_is_deduplicated(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        $payload = [
            'amount'          => 100000,
            'payment_gateway' => 'paystack',
            'idempotency_key' => 'DEP-IDEM-001',
        ];

        $res1 = $this->actingAs($user)->postJson('/api/v1/wallet/deposit', $payload);
        $res1->assertStatus(201);

        $res2 = $this->actingAs($user)->postJson('/api/v1/wallet/deposit', $payload);
        $res2->assertStatus(200);

        $systemWallet = Wallet::where('user_id', $user->id)->where('wallet_type', 'system')->first();
        $this->assertEquals(98500, $systemWallet->available); // 100,000 gross minus 1.5% fee (1,500) = 98,500 net credited
    }

    public function test_creator_can_perform_internal_transfer_to_system_wallet(): void
    {
        $user = User::factory()->create(['role' => 'creator']);
        $ledgerService = new LedgerService();

        // Credit Creator Wallet with ₦10,000.00
        $ledgerService->credit($user, 1000000, 'NGN', 'creator', 'available', 'creator_gift_receipt', 'Test earnings');

        // Internal Transfer ₦4,000.00 from Creator -> System Wallet
        $response = $this->actingAs($user)->postJson('/api/v1/wallet/internal-transfer', [
            'from_wallet_type' => 'creator',
            'to_wallet_type'   => 'system',
            'amount'           => 400000,
            'idempotency_key'   => 'ITX-TEST-001',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Internal transfer completed successfully.');

        $creatorWallet = Wallet::where('user_id', $user->id)->where('wallet_type', 'creator')->first();
        $systemWallet  = Wallet::where('user_id', $user->id)->where('wallet_type', 'system')->first();

        $this->assertEquals(600000, $creatorWallet->available);
        $this->assertEquals(400000, $systemWallet->available);
    }

    public function test_normal_user_cannot_withdraw_directly_from_system_wallet(): void
    {
        $user = User::factory()->create(['role' => 'member']);
        $user->forceFill(['kyc_status' => 'verified'])->save();

        $systemWallet = (new WalletService())->getOrCreateWallet($user, 'system');
        $systemWallet->update(['available' => 500000, 'pin_hash' => bcrypt('1234')]);

        $response = $this->actingAs($user)->postJson('/api/v1/wallet/withdrawals', [
            'wallet_type' => 'system',
            'amount'      => 100000,
            'pin'         => '1234',
        ]);

        $response->assertStatus(403);
        $this->assertStringContainsString('System wallet funds cannot be withdrawn', $response->json('message'));
    }
}
