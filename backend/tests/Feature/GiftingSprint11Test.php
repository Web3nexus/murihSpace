<?php

namespace Tests\Feature;

use App\Models\Gift;
use App\Models\User;

use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GiftingSprint11Test extends TestCase
{
    use RefreshDatabase;

    public function test_gifting_debits_sender_system_wallet_and_credits_creator_wallet_net_of_fee(): void
    {
        $sender    = User::factory()->create(['role' => 'member']);
        $recipient = User::factory()->create(['role' => 'creator']);
        $platform  = User::factory()->create(['role' => 'admin']);

        config()->set('wallet.platform_revenue_user_id', $platform->id);

        // Deposit ₦5,000.00 into Sender System Wallet
        (new LedgerService())->credit($sender, 500000, 'NGN', 'system', 'available', 'deposit');

        $gift = Gift::create([
            'name'                => 'Diamond Crown',
            'coin_price'          => 200000, // ₦2,000.00
            'creator_earns'       => 180000,
            'platform_commission' => 20000,
            'icon'                => '👑',
            'is_active'           => true,
        ]);

        $response = $this->actingAs($sender)->postJson('/api/v1/gifts/send', [
            'gift_id'         => $gift->id,
            'recipient_id'    => $recipient->id,
            'wallet_type'     => 'system',
            'idempotency_key' => 'GIFT-TEST-001',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('message', 'Gift sent successfully!');

        $walletService = new WalletService();
        $senderWallet    = $walletService->getOrCreateWallet($sender, 'system');
        $recipientWallet = $walletService->getOrCreateWallet($recipient, 'creator');
        $platformWallet  = $walletService->getOrCreateWallet($platform, 'system');

        // Sender System Wallet: 500,000 - 200,000 = 300,000 kobo
        $this->assertEquals(300000, $senderWallet->available);

        // Recipient Creator Wallet: 200,000 minus 10% GIFT_RECEIVING fee (20,000) = 180,000 kobo
        $this->assertEquals(180000, $recipientWallet->available);

        // Platform revenue account receives the fee so the ledger balances:
        // debit(200,000) == credit(180,000) + credit(20,000)
        $this->assertEquals(20000, $platformWallet->available);
    }

    public function test_gift_with_reused_idempotency_key_for_different_recipient_is_rejected(): void
    {
        $sender    = User::factory()->create(['role' => 'member']);
        $recipient = User::factory()->create(['role' => 'creator']);
        $other     = User::factory()->create(['role' => 'creator']);

        // Deposit into Sender System Wallet
        (new LedgerService())->credit($sender, 500000, 'NGN', 'system', 'available', 'deposit');

        $gift = Gift::create([
            'name'                => 'Star',
            'coin_price'          => 50000,
            'creator_earns'       => 45000,
            'platform_commission' => 5000,
            'icon'                => '⭐',
            'is_active'           => true,
        ]);

        $payload = [
            'gift_id'         => $gift->id,
            'recipient_id'    => $recipient->id,
            'wallet_type'     => 'system',
            'idempotency_key' => 'GIFT-REUSE-001',
        ];

        $first = $this->actingAs($sender)->postJson('/api/v1/gifts/send', $payload);
        $first->assertStatus(201);

        // Reuse the same key for a different recipient — must be rejected, not replayed.
        $payload['recipient_id'] = $other->id;
        $reuse = $this->actingAs($sender)->postJson('/api/v1/gifts/send', $payload);
        $reuse->assertStatus(500);
        $this->assertStringContainsString('Idempotency key was already used', $reuse->json('message'));
    }

    public function test_gift_without_giftable_context_stores_null_reference(): void
    {
        $sender    = User::factory()->create(['role' => 'member']);
        $recipient = User::factory()->create(['role' => 'creator']);

        (new LedgerService())->credit($sender, 500000, 'NGN', 'system', 'available', 'deposit');

        $gift = Gift::create([
            'name'                => 'Star',
            'coin_price'          => 50000,
            'creator_earns'       => 45000,
            'platform_commission' => 5000,
            'icon'                => '⭐',
            'is_active'           => true,
        ]);

        $response = $this->actingAs($sender)->postJson('/api/v1/gifts/send', [
            'gift_id'      => $gift->id,
            'recipient_id' => $recipient->id,
            'wallet_type'  => 'system',
        ]);

        $response->assertStatus(201);

        $transaction = \App\Models\GiftTransaction::where('sender_id', $sender->id)->first();
        $this->assertNull($transaction->giftable_type);
        $this->assertNull($transaction->giftable_id);
    }

    public function test_sender_cannot_spend_directly_from_creator_wallet_to_send_gifts(): void
    {
        $sender    = User::factory()->create(['role' => 'creator']);
        $recipient = User::factory()->create(['role' => 'creator']);

        $gift = Gift::create([
            'name'                => 'Star',
            'coin_price'          => 50000,
            'creator_earns'       => 45000,
            'platform_commission' => 5000,
            'is_active'           => true,
        ]);

        $response = $this->actingAs($sender)->postJson('/api/v1/gifts/send', [
            'gift_id'      => $gift->id,
            'recipient_id' => $recipient->id,
            'wallet_type'  => 'creator', // Attempt to spend directly from creator wallet
        ]);

        $response->assertStatus(403);
        $this->assertStringContainsString('System Wallet balance', $response->json('message'));
    }
}
