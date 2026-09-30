<?php

namespace Tests\Feature;

use App\Models\AdminSetting;
use App\Models\Country;
use App\Models\Gift;
use App\Models\LiveStream;
use App\Models\LiveStreamMessage;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Payment\LiveExchangeRateService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GiftCatalogueAndChatEnrichmentTest extends TestCase
{
    use RefreshDatabase;

    private function seedCountry(string $iso2, string $currency): void
    {
        Country::create([
            'iso2' => $iso2,
            'iso3' => $iso2,
            'name' => $iso2,
            'currency' => $currency,
        ]);
    }

    private function seedGift(string $name, int $coins): Gift
    {
        return Gift::create([
            'name' => $name,
            'icon_url' => "/gifts/qa_{$name}.png",
            'coin_price' => $coins,
            'creator_earns' => (int) floor($coins * 0.8),
            'platform_commission' => (int) ceil($coins * 0.2),
            'is_active' => true,
            'sort_order' => 1,
        ]);
    }

    public function test_gift_catalogue_converts_to_country_currency_from_usd_setting(): void
    {
        AdminSetting::set('coin_conversion_rate', 10);
        $this->seedCountry('NG', 'NGN');
        $this->seedGift('QA Love', 25);

        $user = User::factory()->create(['country' => 'NG']);

        $response = $this->actingAs($user)->getJson('/api/v1/gifts');

        $response->assertOk()
            ->assertJsonPath('data.coin_conversion_rate', 10);

        $item = collect($response->json('data.data'))->firstWhere('name', 'QA Love');
        $this->assertNotNull($item, 'Catalogue missing QA Love gift.');
        $this->assertSame(25, $item['coin_price']);
        $this->assertSame('NGN', $item['local_currency']);
        $this->assertSame(2.5, $item['price_usd']); // 25 coins / 10 coins-per-USD

        $rate = app(LiveExchangeRateService::class)->getRate('USD', 'NGN');
        $expectedLocal = round(2.5 * $rate, 2);
        $this->assertEqualsWithDelta($expectedLocal, $item['local_price'], 0.01);
        $this->assertStringContainsString('₦', $item['local_formatted']);
    }

    public function test_gift_catalogue_honours_explicit_currency_query(): void
    {
        AdminSetting::set('coin_conversion_rate', 10);
        $this->seedCountry('NG', 'NGN');
        $this->seedGift('QA Love', 10);

        $user = User::factory()->create(['country' => 'NG']);

        $response = $this->actingAs($user)->getJson('/api/v1/gifts?currency=GBP');

        $response->assertOk();
        $item = collect($response->json('data.data'))->firstWhere('name', 'QA Love');
        $this->assertSame('GBP', $item['local_currency']);
    }

    public function test_live_chat_enriches_gift_messages_with_artwork_and_animation(): void
    {
        $host = User::factory()->create(['name' => 'Gift Host']);
        $viewer = User::factory()->create(['name' => 'Fan Viewer']);
        $gift = $this->seedGift('QA Anpu', 250);

        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Gift Stream',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_gift_enrich',
            'viewers_count' => 1,
            'started_at' => now(),
        ]);

        LiveStreamMessage::create([
            'live_stream_id' => $stream->id,
            'user_id' => $viewer->id,
            'gift_id' => $gift->id,
            'message' => "🎁 Someone sent {$gift->name}!",
        ]);
        LiveStreamMessage::create([
            'live_stream_id' => $stream->id,
            'user_id' => $viewer->id,
            // No gift_id: a viewer typing a gift-shaped message must NOT be
            // enriched (no fake celebration animations).
            'message' => "🎁 Fake Viewer sent {$gift->name}!",
        ]);
        LiveStreamMessage::create([
            'live_stream_id' => $stream->id,
            'user_id' => $viewer->id,
            'message' => 'Quick hello',
        ]);

        $response = $this->actingAs($viewer)->getJson("/api/v1/live/{$stream->id}/chat");

        $response->assertOk();

        $giftMsg = collect($response->json('data.data'))->firstWhere('message', "🎁 Someone sent {$gift->name}!");
        $this->assertNotNull($giftMsg);
        $this->assertSame('QA Anpu', $giftMsg['gift_name']);
        $this->assertSame($gift->id, $giftMsg['gift_id']);
        $this->assertSame(250, $giftMsg['coin_price']);
        $this->assertSame('standard', $giftMsg['animation_type']);
        $this->assertStringContainsString('/gifts/qa_QA Anpu.png', $giftMsg['gift_icon_url']);

        $plainMsg = collect($response->json('data.data'))->firstWhere('message', 'Quick hello');
        $this->assertArrayNotHasKey('gift_name', $plainMsg);

        // A gift-shaped message that was not sent through sendGift (no gift_id)
        // must not be enriched with a gift celebration.
        $fakeMsg = collect($response->json('data.data'))->firstWhere('message', "🎁 Fake Viewer sent {$gift->name}!");
        $this->assertNotNull($fakeMsg);
        $this->assertArrayNotHasKey('gift_name', $fakeMsg);
        $this->assertArrayNotHasKey('animation_type', $fakeMsg);
    }

    public function test_live_chat_enriches_full_screen_gifts(): void
    {
        $host = User::factory()->create(['name' => 'Big Tipper Host']);
        $viewer = User::factory()->create(['name' => 'Tipper']);
        $gift = $this->seedGift('QA Cruise', 7500);

        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Big Gifts',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_big_gifts',
            'started_at' => now(),
        ]);

        LiveStreamMessage::create([
            'live_stream_id' => $stream->id,
            'user_id' => $viewer->id,
            'gift_id' => $gift->id,
            'message' => "🎁 Tipper sent {$gift->name}!",
        ]);

        $response = $this->actingAs($viewer)->getJson("/api/v1/live/{$stream->id}/chat");

        $response->assertOk();
        $msg = $response->json('data.data.0');
        $this->assertSame('QA Cruise', $msg['gift_name']);
        $this->assertSame(7500, $msg['coin_price']);
        $this->assertSame('full_screen', $msg['animation_type']);
    }

    public function test_send_gift_persists_gift_id_and_chat_enriches_the_celebration(): void
    {
        $host = User::factory()->create();
        $viewer = User::factory()->create();

        Wallet::create([
            'user_id' => $viewer->id,
            'wallet_type' => 'system',
            'currency' => 'NGN',
            'available' => 5000,
        ]);
        Wallet::create([
            'user_id' => $host->id,
            'wallet_type' => 'creator',
            'currency' => 'NGN',
            'available' => 0,
        ]);

        $gift = $this->seedGift('QA Rocket', 1000);
        $stream = LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Gift End-to-End',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_gift_e2e',
            'viewers_count' => 1,
            'started_at' => now(),
        ]);

        $send = $this->actingAs($viewer)->postJson("/api/v1/live/{$stream->id}/gift", [
            'gift_id' => $gift->id,
            'message' => 'Enjoying the show!',
        ]);
        $send->assertOk();

        $this->assertDatabaseHas('live_stream_messages', [
            'live_stream_id' => $stream->id,
            'user_id' => $viewer->id,
            'gift_id' => $gift->id,
        ]);

        $chat = $this->actingAs($viewer)->getJson("/api/v1/live/{$stream->id}/chat");
        $chat->assertOk();
        $giftMsg = collect($chat->json('data.data'))->firstWhere('gift_id', $gift->id);
        $this->assertNotNull($giftMsg, 'Celebration message was not enriched.');
        $this->assertSame('QA Rocket', $giftMsg['gift_name']);
        $this->assertSame(1000, $giftMsg['coin_price']);
        $this->assertSame('full_screen', $giftMsg['animation_type']);
        $this->assertStringContainsString('/gifts/qa_QA Rocket.png', $giftMsg['gift_icon_url']);
    }

    public function test_gift_catalogue_defaults_to_usd_without_country_signal(): void
    {
        AdminSetting::set('coin_conversion_rate', 10);
        $this->seedGift('QA Love', 25);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson('/api/v1/gifts');

        $response->assertOk();
        $item = collect($response->json('data.data'))->firstWhere('name', 'QA Love');
        $this->assertNotNull($item);
        $this->assertSame('USD', $item['local_currency']);
        $this->assertStringStartsWith('$', $item['local_formatted']);
    }

    public function test_gift_catalogue_derives_currency_from_mobile_calling_code(): void
    {
        AdminSetting::set('coin_conversion_rate', 10);
        Country::create([
            'iso2' => 'NG',
            'iso3' => 'NGA',
            'name' => 'Nigeria',
            'calling_code' => '234',
            'currency' => 'NGN',
        ]);
        $this->seedGift('QA Love', 25);

        $user = User::factory()->create(['country' => null, 'mobile_number' => '+2348012345678']);

        $response = $this->actingAs($user)->getJson('/api/v1/gifts');

        $response->assertOk();
        $item = collect($response->json('data.data'))->firstWhere('name', 'QA Love');
        $this->assertNotNull($item);
        $this->assertSame('NGN', $item['local_currency']);
        $this->assertStringContainsString('₦', $item['local_formatted']);
    }
}