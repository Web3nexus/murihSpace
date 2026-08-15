<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityAndPinTest extends TestCase
{
    use RefreshDatabase;

    public function test_auth_session_issues_long_lived_tokens_by_default(): void
    {
        $user = User::factory()->create();

        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => $user->email,
            'password' => 'password',
        ]);

        $response->assertOk();
        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'name'         => 'auth-token',
        ]);

        $token = $user->tokens()->where('name', 'auth-token')->latest('id')->first();
        $this->assertNotNull($token->expires_at);
        // Should expire around 30 days into the future (persistent session)
        $this->assertTrue($token->expires_at->gt(now()->addDays(29)));
    }

    public function test_platform_config_returns_security_policy(): void
    {
        $response = $this->getJson('/api/v1/platform');

        $response->assertOk()
            ->assertJsonPath('data.security_policy.persistent_session', true)
            ->assertJsonPath('data.security_policy.app_lock_required', true)
            ->assertJsonPath('data.security_policy.transaction_pin_enabled', true)
            ->assertJsonPath('data.security_policy.pin_status_url', '/api/v1/wallet/pin/status');
    }

    public function test_transaction_pin_lifecycle(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-token')->plainTextToken;

        // 1. Initial pin status -> has_pin: false
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/wallet/pin/status')
            ->assertOk()
            ->assertJsonPath('data.data.has_pin', false);

        // 2. Setup PIN
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/wallet/pin/setup', ['pin' => '1234'])
            ->assertOk()
            ->assertJsonPath('data.data.has_pin', true);

        // 3. Status now -> has_pin: true
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/wallet/pin/status')
            ->assertOk()
            ->assertJsonPath('data.data.has_pin', true);

        // 4. Verify correct PIN
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/wallet/pin/verify', ['pin' => '1234'])
            ->assertOk();

        // 5. Verify incorrect PIN -> 403
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/wallet/pin/verify', ['pin' => '9999'])
            ->assertStatus(403);

        // 6. Update PIN
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/wallet/pin/update', [
                'current_pin' => '1234',
                'new_pin'     => '5678',
            ])->assertOk();

        // 7. Verify new PIN
        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/wallet/pin/verify', ['pin' => '5678'])
            ->assertOk();
    }
}
