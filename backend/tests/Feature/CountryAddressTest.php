<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CountryAddressTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\CountrySeeder::class);
    }

    public function test_countries_endpoint_returns_list_of_countries(): void
    {
        $response = $this->getJson('/api/v1/countries');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'data' => [
                        '*' => ['iso2', 'iso3', 'name', 'calling_code', 'flag', 'currency', 'state_required', 'postal_code_required'],
                    ],
                ],
            ]);

        $this->assertNotEmpty($response->json('data.data'));
    }

    public function test_states_endpoint_returns_states_for_valid_country(): void
    {
        $response = $this->getJson('/api/v1/countries/GB/states');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'data' => [
                    'country_iso2',
                    'data' => [
                        '*' => ['id', 'country_iso2', 'code', 'name'],
                    ],
                ],
            ]);

        $this->assertEquals('GB', $response->json('data.country_iso2'));
        $this->assertNotEmpty($response->json('data.data'));
    }

    public function test_registration_accepts_valid_country_iso2_and_e164_phone(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Valid Location User',
            'email' => 'validloc@murihspace.com',
            'username' => 'validlocuser',
            'role' => 'member',
            'country' => 'GB',
            'mobile_number' => '+447911123456',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertStatus(201);

        $user = User::where('email', 'validloc@murihspace.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('GB', $user->country);
        $this->assertEquals('+447911123456', $user->mobile_number);
    }

    public function test_registration_rejects_invalid_country_iso2(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Invalid Country User',
            'email' => 'invalidcountry@murihspace.com',
            'username' => 'invalidcountryuser',
            'role' => 'member',
            'country' => 'ZZ', // invalid ISO2
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonStructure(['errors' => ['country']]);
    }

    public function test_address_creation_validates_state_belongs_to_country(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        // Attempt invalid state for GB
        $invalidResponse = $this->actingAs($user)->postJson('/api/v1/addresses', [
            'label' => 'Home',
            'full_name' => 'Test Person',
            'street_line1' => '123 Fake St',
            'city' => 'London',
            'state' => 'California', // Invalid for GB
            'country' => 'GB',
        ]);

        $invalidResponse->assertStatus(422)
            ->assertJsonStructure(['errors' => ['state']]);

        // Attempt valid state for GB
        $validResponse = $this->actingAs($user)->postJson('/api/v1/addresses', [
            'label' => 'Home',
            'full_name' => 'Test Person',
            'street_line1' => '123 Fake St',
            'city' => 'London',
            'state' => 'England', // Valid for GB
            'country' => 'GB',
        ]);

        $validResponse->assertStatus(201)
            ->assertJsonPath('data.data.country', 'GB')
            ->assertJsonPath('data.data.state', 'England');
    }
}
