<?php

namespace Tests\Unit;

use App\Models\Country;
use App\Models\User;
use App\Services\LocalCurrencyResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LocalCurrencyResolverTest extends TestCase
{
    use RefreshDatabase;

    private Country $nigeria;

    private Country $kenya;

    private Country $usa;

    protected function setUp(): void
    {
        parent::setUp();

        $this->nigeria = Country::create([
            'iso2' => 'NG',
            'iso3' => 'NGA',
            'name' => 'Nigeria',
            'calling_code' => '234',
            'currency' => 'NGN',
        ]);
        $this->kenya = Country::create([
            'iso2' => 'KE',
            'iso3' => 'KEN',
            'name' => 'Kenya',
            'calling_code' => '254',
            'currency' => 'KES',
        ]);
        $this->usa = Country::create([
            'iso2' => 'US',
            'iso3' => 'USA',
            'name' => 'United States',
            'calling_code' => '+1',
            'currency' => 'USD',
        ]);
    }

    public function test_defaults_to_usd_without_any_country_signal(): void
    {
        $context = app(LocalCurrencyResolver::class)->resolve(User::factory()->create());

        $this->assertSame('USD', $context['currency']);
        $this->assertNull($context['country_code']);
        $this->assertSame('default', $context['source']);
    }

    public function test_profile_country_wins_over_phone(): void
    {
        $user = User::factory()->create([
            'country' => 'KE',
            'mobile_number' => '+2347012345678',
        ]);

        $context = app(LocalCurrencyResolver::class)->resolve($user);

        $this->assertSame('KES', $context['currency']);
        $this->assertSame('KE', $context['country_code']);
        $this->assertSame('profile', $context['source']);
    }

    public function test_derives_currency_from_mobile_calling_code(): void
    {
        $user = User::factory()->create([
            'country' => null,
            'mobile_number' => '+2347012345678',
        ]);

        $context = app(LocalCurrencyResolver::class)->resolve($user);

        $this->assertSame('NGN', $context['currency']);
        $this->assertSame('NG', $context['country_code']);
        $this->assertSame('phone', $context['source']);
    }

    public function test_phone_calling_code_with_plus_and_dashed_format(): void
    {
        $user = User::factory()->create([
            'country' => null,
            'mobile_number' => '+254-712-345-678',
        ]);

        $context = app(LocalCurrencyResolver::class)->resolve($user);

        $this->assertSame('KES', $context['currency']);
        $this->assertSame('KE', $context['country_code']);
    }

    public function test_unknown_calling_code_falls_back_to_usd(): void
    {
        $user = User::factory()->create([
            'country' => null,
            'mobile_number' => '+99912345678',
        ]);

        $context = app(LocalCurrencyResolver::class)->resolve($user);

        $this->assertSame('USD', $context['currency']);
        $this->assertNull($context['country_code']);
    }

    public function test_null_user_resolves_to_usd_default(): void
    {
        $context = app(LocalCurrencyResolver::class)->resolve(null);

        $this->assertSame('USD', $context['currency']);
        $this->assertNull($context['country_code']);
    }
}