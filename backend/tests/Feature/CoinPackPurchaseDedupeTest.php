<?php

namespace Tests\Feature;

use App\Models\CoinPack;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * Regression cover for coin-pack purchase idempotency: retrying with the same
 * client `reference` must not credit coins or record a sale twice.
 */
class CoinPackPurchaseDedupeTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function coins(User $user): int
    {
        $wallet = Wallet::where('user_id', $user->id)->where('wallet_type', 'system')->first();
        return (int) ($wallet?->available ?? 0);
    }

    private function pack(): CoinPack
    {
        return CoinPack::create([
            'name' => 'Starter', 'coins' => 100, 'bonus_coins' => 0,
            'price' => 1000, 'currency' => 'USD', 'is_active' => true, 'sort_order' => 1,
        ]);
    }

    public function test_purchase_with_same_reference_credits_once(): void
    {
        $platform = \App\Models\User::factory()->create(['role' => 'admin']);
        config()->set('wallet.platform_revenue_user_id', $platform->id);
        $pack = $this->pack();
        $user = User::factory()->create();

        $first = $this->actingAs($user)->postJson('/api/v1/coins/purchase', [
            'coin_pack_id' => $pack->id,
            'reference' => 'REF-DEDUPE-1',
        ]);
        $first->assertStatus(201);
        $this->assertSame(100, (int) $first->json('data.data.coins_added'));
        $this->assertSame(100, $this->coins($user));

        $second = $this->actingAs($user)->postJson('/api/v1/coins/purchase', [
            'coin_pack_id' => $pack->id,
            'reference' => 'REF-DEDUPE-1',
        ]);
        $second->assertStatus(200)->assertJsonPath('data.duplicate', true);

        $this->assertSame(100, $this->coins($user));
        $this->assertDatabaseCount('coin_purchases', 1);
    }

    public function test_distinct_references_credit_separately(): void
    {
        $platform = \App\Models\User::factory()->create(['role' => 'admin']);
        config()->set('wallet.platform_revenue_user_id', $platform->id);
        $pack = $this->pack();
        $user = User::factory()->create();

        $this->actingAs($user)
            ->postJson('/api/v1/coins/purchase', ['coin_pack_id' => $pack->id, 'reference' => 'REF-A'])
            ->assertStatus(201);
        $this->actingAs($user)
            ->postJson('/api/v1/coins/purchase', ['coin_pack_id' => $pack->id, 'reference' => 'REF-B'])
            ->assertStatus(201);

        $this->assertSame(200, $this->coins($user));
        $this->assertDatabaseCount('coin_purchases', 2);
    }
}
