<?php

namespace Tests\Feature;

use App\Models\DeviceSession;
use App\Models\PendingLoginRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class DeviceSecurityAndApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_new_device_login_creates_pending_request_when_active_session_exists(): void
    {
        $user = User::factory()->create([
            'email' => 'alex@example.com',
            'password' => Hash::make('SecretPass123!'),
        ]);

        // Device A is already logged in
        $tokenA = $user->createToken('auth-token')->plainTextToken;
        DeviceSession::create([
            'user_id' => $user->id,
            'device_id' => 'device_a_uuid',
            'device_name' => 'Alex iPhone',
            'platform' => 'ios',
            'is_trusted' => true,
            'last_active_at' => now(),
        ]);

        // Device B attempts login
        $res = $this->withHeaders([
            'X-Device-ID' => 'device_b_uuid',
            'User-Agent' => 'MurihSpace/1.0 (Android 14; Pixel 8)',
        ])->postJson('/api/v1/auth/login', [
            'email' => 'alex@example.com',
            'password' => 'SecretPass123!',
            'device_name' => 'Alex Pixel',
            'platform' => 'android',
        ]);

        $res->assertStatus(202)
            ->assertJsonPath('data.status', 'pending_device_approval')
            ->assertJsonStructure([
                'data' => [
                    'status',
                    'pending_request' => ['request_id', 'request_token', 'device_name', 'platform', 'expires_at'],
                ],
            ]);

        $this->assertDatabaseHas('pending_login_requests', [
            'user_id' => $user->id,
            'device_id' => 'device_b_uuid',
            'status' => 'pending',
        ]);
    }

    public function test_existing_device_can_approve_new_device_login(): void
    {
        $user = User::factory()->create();

        $pending = PendingLoginRequest::create([
            'user_id' => $user->id,
            'request_token' => 'req_token_xyz_123',
            'device_id' => 'device_new_uuid',
            'device_name' => 'iPad Air',
            'platform' => 'ios',
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
        ]);

        // Existing device approves
        $res = $this->actingAs($user)->postJson("/api/v1/auth/device-approval/{$pending->id}/approve");
        $res->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        $this->assertEquals('approved', $pending->fresh()->status);

        // New device checks status
        $statusRes = $this->getJson("/api/v1/auth/device-approval/check-status/req_token_xyz_123");
        $statusRes->assertStatus(200)
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonStructure(['data' => ['status', 'token', 'user']]);
    }

    public function test_existing_device_can_deny_new_device_login(): void
    {
        $user = User::factory()->create();

        $pending = PendingLoginRequest::create([
            'user_id' => $user->id,
            'request_token' => 'req_token_deny_456',
            'device_id' => 'suspicious_device',
            'device_name' => 'Unknown PC',
            'platform' => 'windows',
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
        ]);

        // Existing device denies
        $res = $this->actingAs($user)->postJson("/api/v1/auth/device-approval/{$pending->id}/deny");
        $res->assertStatus(200)
            ->assertJsonPath('data.status', 'denied');

        $this->assertEquals('denied', $pending->fresh()->status);

        // Suspicious device checks status
        $statusRes = $this->getJson("/api/v1/auth/device-approval/check-status/req_token_deny_456");
        $statusRes->assertStatus(403)
            ->assertJsonPath('errors.status', 'denied');
    }

    public function test_user_can_revoke_all_other_sessions(): void
    {
        $user = User::factory()->create();
        $token1 = $user->createToken('auth-token');
        $token2 = $user->createToken('auth-token');
        $tokenCurrent = $user->createToken('auth-token');

        $res = $this->withToken($tokenCurrent->plainTextToken)
            ->postJson('/api/v1/auth/sessions/revoke-all-others');

        $res->assertStatus(200);

        // Current token is preserved, others deleted
        $this->assertEquals(1, $user->tokens()->count());
        $this->assertEquals($tokenCurrent->accessToken->id, $user->tokens()->first()->id);
    }
}
