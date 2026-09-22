<?php

namespace Tests\Feature;

use App\Models\Country;
use App\Models\DigitalProduct;
use App\Models\Escrow;
use App\Models\FulfilmentOrder;
use App\Models\FulfilmentOrderItem;
use App\Models\LiveStream;
use App\Models\Order;
use App\Models\PhysicalProduct;
use App\Models\TaxRate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;
use Tests\TestCase;

class LivePurchaseFeatureTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('livekit.api_key', 'TEST_LK_API_KEY');
        Config::set('livekit.api_secret', 'TEST_LK_SECRET_12345678901234567890');
        Config::set('livekit.host', 'https://livekit.test.murihspace.com');
    }

    private function liveStreamFor(User $host, ?int $pinnedProductId): LiveStream
    {
        return LiveStream::create([
            'user_id' => $host->id,
            'title' => 'Shop Live',
            'stream_mode' => 'video',
            'status' => 'live',
            'livekit_room' => 'room_purchase_' . Str::random(6),
            'viewers_count' => 1,
            'started_at' => now(),
            'pinned_product_id' => $pinnedProductId,
        ]);
    }

    private function digitalProductFor(User $creator, float $price = 20.0): DigitalProduct
    {
        return DigitalProduct::create([
            'creator_id' => $creator->id,
            'title' => fake()->words(3, true),
            'slug' => 'prod-' . Str::uuid(),
            'price' => $price,
            'currency' => 'USD',
            'is_free' => false,
            'status' => 'published',
            'category' => 'ebook',
        ]);
    }

    public function test_viewer_can_purchase_pinned_digital_product_instantly(): void
    {
        $host = User::factory()->create();
        $buyer = User::factory()->create();

        $product = $this->digitalProductFor($host);

        $stream = $this->liveStreamFor($host, $product->id);

        $res = $this->actingAs($buyer)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'test-idem-digital-1',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.product_type', 'digital')
            ->assertJsonPath('data.order.status', 'completed')
            ->assertJsonPath('data.order.product_id', $product->id);

        $this->assertDatabaseHas('orders', [
            'buyer_id' => $buyer->id,
            'creator_id' => $host->id,
            'product_id' => $product->id,
            'status' => 'completed',
        ]);

        $this->assertEquals(1, $product->fresh()->download_count);
    }

    public function test_live_digital_purchase_is_idempotent_on_retry(): void
    {
        $host = User::factory()->create();
        $buyer = User::factory()->create();

        $product = $this->digitalProductFor($host, 15.0);

        $stream = $this->liveStreamFor($host, $product->id);

        $this->actingAs($buyer)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'test-idem-repeat',
        ])->assertStatus(201);

        $this->actingAs($buyer)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'test-idem-repeat',
        ])->assertStatus(200);

        $this->assertEquals(1, Order::where('idempotency_key', 'test-idem-repeat')->count());
        $this->assertEquals(1, $product->fresh()->download_count);
    }

    public function test_viewer_can_purchase_pinned_physical_product_with_escrow(): void
    {
        $host = User::factory()->create();
        $buyer = User::factory()->create();

        $product = PhysicalProduct::create([
            'creator_id' => $host->id,
            'title' => 'Signed Merch Tee',
            'sku' => 'TEE-001',
            'price' => 50000,
            'currency' => 'NGN',
            'category' => 'clothing',
            'track_inventory' => true,
            'stock_quantity' => 5,
            'is_active' => true,
        ]);

        $stream = $this->liveStreamFor($host, $product->id);

        $res = $this->actingAs($buyer)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'test-idem-physical-1',
        ]);

        $res->assertStatus(201)
            ->assertJsonPath('data.product_type', 'physical')
            ->assertJsonPath('data.order.status', 'confirmed');

        $order = FulfilmentOrder::where('buyer_id', $buyer->id)->first();
        $this->assertNotNull($order);
        $this->assertEquals(50000, $order->subtotal);
        $this->assertEquals(2500, $order->platform_fee);
        $this->assertEquals('confirmed', $order->status);

        $this->assertDatabaseHas('fulfilment_order_items', [
            'fulfilment_order_id' => $order->id,
            'physical_product_id' => $product->id,
            'quantity' => 1,
            'unit_price' => 50000,
        ]);

        $this->assertDatabaseHas('escrows', [
            'fulfilment_order_id' => $order->id,
            'buyer_id' => $buyer->id,
            'seller_id' => $host->id,
            'status' => 'held',
            'amount' => 50000, // seller share only; tax + platform fee excluded from escrow
        ]);

        $this->assertEquals(4, $product->fresh()->stock_quantity);
    }

    public function test_host_cannot_purchase_from_own_stream(): void
    {
        $host = User::factory()->create();

        $product = $this->digitalProductFor($host, 10.0);

        $stream = $this->liveStreamFor($host, $product->id);

        $this->actingAs($host)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'test-idem-self',
        ])->assertStatus(422)
            ->assertJsonPath('errors.code', 'SELF_PURCHASE_PROHIBITED');

        $this->assertDatabaseMissing('orders', ['product_id' => $product->id]);
    }

    public function test_only_pinned_product_can_be_purchased_on_a_stream(): void
    {
        $host = User::factory()->create();
        $buyer = User::factory()->create();

        $pinned = $this->digitalProductFor($host, 5.0);
        $other = $this->digitalProductFor($host, 8.0);

        $stream = $this->liveStreamFor($host, $pinned->id);

        $this->actingAs($buyer)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $other->id,
            'idempotency_key' => 'test-idem-other',
        ])->assertStatus(422)
            ->assertJsonPath('errors.code', 'PRODUCT_NOT_PINNED');
    }

    public function test_stream_without_pinned_product_rejects_all_purchases(): void
    {
        $host = User::factory()->create();
        $buyer = User::factory()->create();

        $product = $this->digitalProductFor($host, 5.0);

        $stream = $this->liveStreamFor($host, null);

        $this->actingAs($buyer)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'test-idem-nopin',
        ])->assertStatus(422)
            ->assertJsonPath('errors.code', 'PRODUCT_NOT_PINNED');

        $this->assertDatabaseMissing('orders', ['buyer_id' => $buyer->id]);
    }

    public function test_physical_purchase_is_idempotent_on_retry(): void
    {
        $host = User::factory()->create();
        $buyer = User::factory()->create();

        $product = PhysicalProduct::create([
            'creator_id' => $host->id,
            'title' => 'Retry Tee',
            'sku' => 'RETRY-001',
            'price' => 30000,
            'currency' => 'NGN',
            'category' => 'clothing',
            'track_inventory' => true,
            'stock_quantity' => 10,
            'is_active' => true,
        ]);

        $stream = $this->liveStreamFor($host, $product->id);

        $this->actingAs($buyer)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'test-idem-phy-repeat',
        ])->assertStatus(201);

        $this->actingAs($buyer)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'test-idem-phy-repeat',
        ])->assertStatus(200)
            ->assertJsonPath('data.product_type', 'physical');

        $this->assertEquals(1, FulfilmentOrder::where('idempotency_key', 'test-idem-phy-repeat')->count());
        $this->assertEquals(1, FulfilmentOrderItem::count());
        $this->assertEquals(1, Escrow::count());
        $this->assertEquals(9, $product->fresh()->stock_quantity);
    }

    public function test_digital_idempotency_key_is_scoped_to_buyer(): void
    {
        $host = User::factory()->create();
        $buyerA = User::factory()->create();
        $buyerB = User::factory()->create();

        $product = $this->digitalProductFor($host, 12.0);

        $stream = $this->liveStreamFor($host, $product->id);

        $this->actingAs($buyerA)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'shared-key',
        ])->assertStatus(201);

        // Buyer B reusing Buyer A's key must not receive Buyer A's order.
        $res = $this->actingAs($buyerB)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'shared-key',
        ])->assertStatus(201);

        $res->assertJsonPath('data.order.buyer_id', $buyerB->id);

        $this->assertEquals(1, Order::where('buyer_id', $buyerA->id)->count());
        $this->assertEquals(1, Order::where('buyer_id', $buyerB->id)->count());
        $this->assertEquals(2, $product->fresh()->download_count);
    }

    public function test_escrow_holds_only_seller_share_excluding_tax(): void
    {
        $host = User::factory()->create();
        $buyer = User::factory()->create();
        $buyer->country = 'NL'; // applies 21% destination VAT
        $buyer->save();

        Country::create([
            'iso2' => 'NL',
            'iso3' => 'NLD',
            'name' => 'Netherlands',
        ]);

        TaxRate::updateOrCreate(
            ['country_code' => 'NLD', 'tax_name' => 'Value Added Tax (VAT)'],
            [
                'country_name' => 'Netherlands',
                'standard_rate_percentage' => 21.00,
                'wht_rate_percentage' => 0.00,
                'stream_rates' => ['commerce' => 21.00],
                'is_active' => true,
            ]
        );

        $product = PhysicalProduct::create([
            'creator_id' => $host->id,
            'title' => 'VAT Tee',
            'sku' => 'VAT-001',
            'price' => 100000,
            'currency' => 'EUR',
            'category' => 'clothing',
            'track_inventory' => true,
            'stock_quantity' => 5,
            'is_active' => true,
        ]);

        $stream = $this->liveStreamFor($host, $product->id);

        $res = $this->actingAs($buyer)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'test-idem-vat',
        ])->assertStatus(201);

        $order = FulfilmentOrder::where('buyer_id', $buyer->id)->first();
        $this->assertNotNull($order);
        $this->assertGreaterThan(0, $order->tax);

        // Escrow holds the seller's share (subtotal), never the collected tax.
        $escrow = Escrow::where('fulfilment_order_id', $order->id)->first();
        $this->assertEquals($order->subtotal, $escrow->amount);
        $this->assertNotEquals($order->total - $order->platform_fee, $escrow->amount);
        $this->assertLessThan($order->total - $order->platform_fee, $escrow->amount);

        $res->assertJsonPath('data.order.total', $order->total);
    }

    public function test_out_of_stock_physical_product_cannot_be_purchased(): void
    {
        $host = User::factory()->create();
        $buyer = User::factory()->create();

        $product = PhysicalProduct::create([
            'creator_id' => $host->id,
            'title' => 'Sold Out Item',
            'sku' => 'SO-001',
            'price' => 10000,
            'currency' => 'NGN',
            'track_inventory' => true,
            'stock_quantity' => 0,
            'is_active' => true,
        ]);

        $stream = $this->liveStreamFor($host, $product->id);

        $this->actingAs($buyer)->postJson("/api/v1/live/{$stream->id}/purchase", [
            'product_id' => $product->id,
            'idempotency_key' => 'test-idem-oot',
        ])->assertStatus(409)
            ->assertJsonPath('errors.code', 'OUT_OF_STOCK');

        $this->assertDatabaseMissing('fulfilment_orders', ['buyer_id' => $buyer->id]);
    }
}