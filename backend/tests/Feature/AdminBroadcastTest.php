<?php

namespace Tests\Feature;

use App\Models\DeviceSession;
use App\Models\PendingLoginRequest;
use App\Models\SystemBroadcast;
use App\Models\User;
use App\Notifications\MurihOfficialNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AdminBroadcastTest extends TestCase
{
    use RefreshDatabase;

    private function createAdmin(): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'super_admin',
        ]);
    }

    public function test_admin_can_dispatch_broadcast_to_all_users(): void
    {
        Notification::fake();

        $admin = $this->createAdmin();
        $users = User::factory()->count(3)->create();

        $res = $this->actingAs($admin)->postJson('/api/v1/securegate/broadcasts', [
            'title' => 'Scheduled Maintenance',
            'body' => 'MurihSpace will undergo maintenance on Sunday at 2 AM UTC.',
            'type' => 'announcement',
            'target_audience' => 'all',
            'action_url' => '/status',
            'action_label' => 'Check Status',
        ]);

        $res->assertCreated()
            ->assertJsonPath('data.broadcast.title', 'Scheduled Maintenance');

        $this->assertDatabaseHas('system_broadcasts', [
            'title' => 'Scheduled Maintenance',
            'type' => 'announcement',
            'target_audience' => 'all',
        ]);

        Notification::assertSentTo(
            $users,
            MurihOfficialNotification::class,
            function ($notification) {
                return $notification->title === 'Scheduled Maintenance'
                    && $notification->type === 'announcement';
            }
        );
    }

    public function test_user_can_fetch_system_broadcasts(): void
    {
        $admin = $this->createAdmin();
        $user = User::factory()->create(['role' => 'creator']);

        SystemBroadcast::create([
            'admin_id' => $admin->id,
            'title' => 'Creator Economy Boost',
            'body' => 'New monetization features are available for verified creators.',
            'type' => 'system_update',
            'target_audience' => 'creators',
            'sent_at' => now(),
            'recipients_count' => 1,
        ]);

        $res = $this->actingAs($user)->getJson('/api/v1/system-broadcasts');

        $res->assertOk()
            ->assertJsonFragment(['title' => 'Creator Economy Boost']);
    }

    public function test_non_admin_cannot_dispatch_broadcast(): void
    {
        $user = User::factory()->create(['role' => 'user']);

        $res = $this->actingAs($user)->postJson('/api/v1/securegate/broadcasts', [
            'title' => 'Unauthorized Alert',
            'body' => 'Should fail.',
            'type' => 'announcement',
            'target_audience' => 'all',
        ]);

        $res->assertForbidden();
    }

    public function test_device_approval_verify_code(): void
    {
        $user = User::factory()->create();

        $code = '654321';
        $pending = PendingLoginRequest::create([
            'user_id' => $user->id,
            'request_token' => 'req_token_test_code_123',
            'verification_code_hash' => hash('sha256', $code),
            'attempts' => 0,
            'delivery_channel' => 'in_app_active_device',
            'device_id' => 'dev_phone_abc',
            'device_name' => 'iPhone 15',
            'platform' => 'ios',
            'ip' => '127.0.0.1',
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
        ]);

        // Wrong code fails
        $wrongRes = $this->postJson('/api/v1/auth/device-approval/verify-code', [
            'request_token' => 'req_token_test_code_123',
            'code' => '000000',
        ]);
        $wrongRes->assertStatus(422)
            ->assertJsonPath('errors.status', 'invalid_code');

        // Correct code succeeds
        $correctRes = $this->postJson('/api/v1/auth/device-approval/verify-code', [
            'request_token' => 'req_token_test_code_123',
            'code' => '654321',
        ]);
        $correctRes->assertOk()
            ->assertJsonPath('data.status', 'approved')
            ->assertJsonStructure(['data' => ['status', 'token', 'user']]);

        $this->assertEquals('approved', $pending->fresh()->status);
    }
}
