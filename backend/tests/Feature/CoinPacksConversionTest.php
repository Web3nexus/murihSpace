<?php

namespace Tests\Feature;

use App\Models\AdminSetting;
use App\Models\CoinPack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CoinPacksConversionTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalogue_includes_configurable_conversion_rate(): void
    {
        AdminSetting::set('coin_conversion_rate', 10);
        CoinPack::create([
            'name' => 'Starter', 'coins' => 100, 'bonus_coins' => 0,
            'price' => 1000, 'currency' => 'USD', 'sort_order' => 1,
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/coins/packs');

        $response->assertOk();
        $response->assertJsonPath('data.coin_conversion_rate', 10);
        $response->assertJsonPath('data.min_purchase_usd', 1);
        $response->assertJsonCount(1, 'data.data');
    }

    public function test_custom_purchase_credits_coins_at_configured_rate(): void
    {
        AdminSetting::set('coin_conversion_rate', 10);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/coins/purchase-custom', [
            'amount_usd' => 25.0,
        ]);

        $response->assertStatus(201);
        $this->assertSame(250, (int) $response->json('data.data.coins_added'));
    }

    public function test_custom_purchase_honours_updated_admin_rate(): void
    {
        AdminSetting::set('coin_conversion_rate', 20);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/coins/purchase-custom', [
            'amount_usd' => 5.0,
        ]);

        $response->assertStatus(201);
        $this->assertSame(100, (int) $response->json('data.data.coins_added'));
    }

    public function test_pack_purchase_credits_full_total_coins(): void
    {
        $pack = CoinPack::create([
            'name' => 'Popular', 'coins' => 250, 'bonus_coins' => 25,
            'price' => 2500, 'currency' => 'USD', 'sort_order' => 1,
        ]);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/coins/purchase', [
            'coin_pack_id' => $pack->id,
        ]);

        $response->assertStatus(201);
        $this->assertSame(275, (int) $response->json('data.data.coins_added'));
        $this->assertDatabaseHas('coin_purchases', [
            'user_id' => $user->id,
            'coin_pack_id' => $pack->id,
            'coins' => 250,
            'bonus_coins' => 25,
            'status' => 'completed',
        ]);
    }

    public function test_custom_purchase_rejects_out_of_range_amount(): void
    {
        AdminSetting::set('coin_conversion_rate', 10);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->postJson('/api/v1/coins/purchase-custom', [
            'amount_usd' => 0.25,
        ]);

        $response->assertStatus(422);
    }

    public function test_admin_rate_round_trip(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $this->actingAs($admin)->getJson('/api/v1/securegate/coin-packs/rate')
            ->assertOk()
            ->assertJsonPath('data.data.coin_conversion_rate', 10);

        $this->actingAs($admin)->putJson('/api/v1/securegate/coin-packs/rate', [
            'coin_conversion_rate' => 12,
            'coin_max_purchase_usd' => 5000,
        ])->assertOk()->assertJsonPath('data.data.coin_conversion_rate', 12);

        $this->assertSame('12', AdminSetting::get('coin_conversion_rate'));
    }
}