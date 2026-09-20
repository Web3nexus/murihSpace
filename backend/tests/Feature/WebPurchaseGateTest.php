<?php

namespace Tests\Feature;

use App\Models\AdminSetting;
use App\Models\CoinPack;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WebPurchaseGateTest extends TestCase
{
    use RefreshDatabase;

    private function pack(): CoinPack
    {
        return CoinPack::create([
            'name' => 'Popular',
            'coins' => 250,
            'bonus_coins' => 25,
            'price' => 2500,
            'currency' => 'USD',
            'sort_order' => 1,
        ]);
    }

    public function test_web_purchases_are_allowed_by_default(): void
    {
        $user = User::factory()->create();
        $pack = $this->pack();

        $response = $this->withHeader('X-Client-Platform', 'web')
            ->actingAs($user)
            ->postJson('/api/v1/coins/purchase', ['coin_pack_id' => $pack->id]);

        $response->assertStatus(201);
    }

    public function test_requests_without_platform_header_default_to_allowed_when_toggle_on(): void
    {
        AdminSetting::set('web_purchases_enabled', true);

        $user = User::factory()->create();
        $pack = $this->pack();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/coins/purchase-custom', ['amount_usd' => 5.0]);

        $response->assertStatus(201);
    }

    public function test_web_purchase_is_blocked_when_toggle_off(): void
    {
        AdminSetting::set('web_purchases_enabled', false);

        $user = User::factory()->create();
        $pack = $this->pack();

        $response = $this->withHeader('X-Client-Platform', 'web')
            ->actingAs($user)
            ->postJson('/api/v1/coins/purchase', ['coin_pack_id' => $pack->id]);

        $response->assertStatus(403);
        $response->assertJsonPath('errors.code', 'WEB_PURCHASES_DISABLED');
    }

    public function test_missing_platform_header_is_blocked_when_toggle_off(): void
    {
        AdminSetting::set('web_purchases_enabled', false);

        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/coins/purchase-custom', ['amount_usd' => 5.0]);

        $response->assertStatus(403);
        $response->assertJsonPath('errors.code', 'WEB_PURCHASES_DISABLED');
    }

    public function test_native_app_purchase_still_allowed_when_toggle_off(): void
    {
        AdminSetting::set('web_purchases_enabled', false);

        $user = User::factory()->create();

        $response = $this->withHeader('X-Client-Platform', 'app')
            ->actingAs($user)
            ->postJson('/api/v1/coins/purchase-custom', ['amount_usd' => 5.0]);

        $response->assertStatus(201);
        $this->assertSame(50, (int) $response->json('data.data.coins_added'));
    }

    public function test_payment_method_apple_pay_is_accepted_on_app_purchase(): void
    {
        AdminSetting::set('web_purchases_enabled', false);

        $user = User::factory()->create();

        // No provider routes seeded -> mock flow still runs, the method is just validated.
        $response = $this->withHeader('X-Client-Platform', 'app')
            ->actingAs($user)
            ->postJson('/api/v1/coins/purchase-custom', [
                'amount_usd' => 5.0,
                'payment_method' => 'apple_pay',
            ]);

        $response->assertStatus(201);
    }

    public function test_invalid_payment_method_is_rejected(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)
            ->postJson('/api/v1/coins/purchase-custom', [
                'amount_usd' => 5.0,
                'payment_method' => 'crypto',
            ]);

        $response->assertStatus(422);
    }
}