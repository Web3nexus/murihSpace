<?php

namespace Tests\Feature;

use App\Models\Address;
use App\Models\Cart;
use App\Models\CartItem;
use App\Models\Country;
use App\Models\PhysicalProduct;
use App\Models\TaxRate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FulfilmentCheckoutTaxTest extends TestCase
{
    use RefreshDatabase;

    private User $buyer;

    private User $seller;

    private PhysicalProduct $product;

    private Address $address;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buyer = User::factory()->create(['email_verified_at' => now()]);
        $this->seller = User::factory()->create();

        $this->product = PhysicalProduct::create([
            'creator_id' => $this->seller->id,
            'title' => 'Testland Mug',
            'sku' => 'MUG-TST',
            'price' => 2000,
            'currency' => 'NGN',
            'category' => 'home',
            'track_inventory' => true,
            'stock_quantity' => 10,
            'is_active' => true,
        ]);

        Country::create([
            'iso2' => 'NG',
            'iso3' => 'NGA',
            'name' => 'Nigeria',
        ]);

        TaxRate::updateOrCreate(
            ['country_code' => 'NGA', 'tax_name' => 'Value Added Tax (VAT)'],
            [
                'country_name' => 'Nigeria',
                'standard_rate_percentage' => 10.00,
                'wht_rate_percentage' => 0.00,
                'stream_rates' => ['commerce' => 10.00],
                'is_active' => true,
            ]
        );

        $this->address = Address::create([
            'user_id' => $this->buyer->id,
            'label' => 'Home',
            'full_name' => 'Test Buyer',
            'street_line1' => '1 Test St',
            'city' => 'Testerville',
            'state' => 'TS',
            'country' => 'NG',
            'type' => 'shipping',
        ]);

        $cart = Cart::firstOrCreate(['user_id' => $this->buyer->id]);
        CartItem::create([
            'cart_id' => $cart->id,
            'physical_product_id' => $this->product->id,
            'quantity' => 2,
        ]);
    }

    public function test_checkout_estimate_returns_vat_applied_to_shipping_country(): void
    {
        $res = $this->actingAs($this->buyer)->postJson('/api/v1/store/fulfilment/checkout-estimate', [
            'shipping_address_id' => $this->address->id,
        ]);

        $res->assertOk();
        $res->assertJsonPath('data.data.subtotal', 4000);
        $res->assertJsonPath('data.data.platform_fee', 200);
        $res->assertJsonPath('data.data.tax', 400);
        $res->assertJsonPath('data.data.tax_rate', 10);
        $res->assertJsonPath('data.data.tax_country_code', 'NGA');
        $res->assertJsonPath('data.data.total', 4600);
    }

    public function test_physical_checkout_records_vat_liability(): void
    {
        $res = $this->actingAs($this->buyer)->postJson('/api/v1/store/fulfilment/checkout', [
            'shipping_address_id' => $this->address->id,
        ]);

        $res->assertStatus(201);

        $this->assertDatabaseHas('fulfilment_orders', [
            'buyer_id' => $this->buyer->id,
            'subtotal' => 4000,
            'tax' => 400,
            'tax_country_code' => 'NGA',
            'tax_type' => 'vat',
            'total' => 4600,
        ]);

        $this->assertDatabaseHas('tax_liabilities', [
            'period_identifier' => now()->format('Y-m'),
            'country_code' => 'NGA',
            'currency' => 'NGN',
            'tax_type' => 'VAT',
            'tax_collected_cents' => 400,
        ]);
    }
}