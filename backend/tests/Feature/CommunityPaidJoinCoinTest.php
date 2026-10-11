<?php

namespace Tests\Feature;

use App\Models\Community;
use App\Models\Wallet;
use App\Models\User;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * Regression for the paid-community join flow, which read/decremented a
 * non-existent `coin_balance` column. Coins are the System Wallet `available`
 * balance (100 coins = $1.00 USD), so the flow must move that column.
 */
class CommunityPaidJoinCoinTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function fundSystemWallet(User $user, int $available): void
    {
        (new WalletService())->getOrCreateWallet($user, 'system')->update(['available' => $available]);
    }

    private function systemAvailable(User $user): int
    {
        return (int) (Wallet::where('user_id', $user->id)->where('wallet_type', 'system')->value('available') ?? 0);
    }

    private function paidCommunity(User $creator, int $price): Community
    {
        return Community::factory()->create([
            'user_id' => $creator->id,
            'pricing_type' => 'paid',
            'price_amount' => $price,
            'visibility' => 'public',
        ]);
    }

    public function test_paid_join_debits_member_and_credits_creator_coins(): void
    {
        $creator = User::factory()->create(['role' => 'creator']);
        $member = User::factory()->create(['role' => 'member']);
        $this->fundSystemWallet($member, 5000);

        $community = $this->paidCommunity($creator, 1000);

        $this->actingAs($member)
            ->postJson("/api/v1/communities/{$community->id}/join")
            ->assertOk();

        $this->assertSame(4000, $this->systemAvailable($member));
        $this->assertSame(1000, $this->systemAvailable($creator));

        // The movement must be recorded in the double-entry ledger, not applied
        // as a bare column update (which would drift reconciliation).
        $this->assertDatabaseHas('ledger_transactions', [
            'type' => 'community_join',
        ]);
        $this->assertDatabaseHas('ledger_transactions', [
            'type' => 'community_join_receipt',
        ]);

        $this->assertDatabaseHas('community_memberships', [
            'community_id' => $community->id,
            'user_id' => $member->id,
            'status' => 'active',
        ]);
    }

    public function test_paid_join_is_rejected_without_enough_coins(): void
    {
        $creator = User::factory()->create(['role' => 'creator']);
        $member = User::factory()->create(['role' => 'member']);
        $this->fundSystemWallet($member, 500);

        $community = $this->paidCommunity($creator, 1000);

        $this->actingAs($member)
            ->postJson("/api/v1/communities/{$community->id}/join")
            ->assertStatus(402)
            ->assertJsonPath('errors.code', 'INSUFFICIENT_FUNDS');

        $this->assertSame(500, $this->systemAvailable($member));
        $this->assertSame(0, $this->systemAvailable($creator));
    }
}
