<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class AdminManualKycVerificationTest extends TestCase
{
    use ActsAsSession;

    use RefreshDatabase;

    public function test_admin_can_manually_verify_user_via_admin_kyc_endpoint(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'unsubmitted']);

        $res = $this->actingAsSession($admin)->postJson("/api/v1/securegate/kyc/{$user->id}/approve");

        $res->assertStatus(200);
        $this->assertEquals('verified', $user->fresh()->kyc_status);
        $this->assertTrue($user->fresh()->hasVerifiedKyc());
    }

    public function test_admin_can_manually_verify_user_via_admin_users_endpoint(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending']);

        $res = $this->actingAsSession($admin)->postJson("/api/v1/securegate/users/{$user->id}/verify-kyc");

        $res->assertStatus(200);
        $res->assertJsonPath('success', true);
        $this->assertEquals('verified', $user->fresh()->kyc_status);
    }

    public function test_non_kyc_admin_cannot_verify_kyc_via_users_endpoint(): void
    {
        $supportAdmin = User::factory()->create([
            'role' => 'admin',
            'admin_role' => \App\Enums\AdminRole::SupportAdmin->value,
        ]);
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending']);

        $res = $this->actingAsSession($supportAdmin)->postJson("/api/v1/securegate/users/{$user->id}/verify-kyc");

        $res->assertForbidden();
        $this->assertEquals('pending', $user->fresh()->kyc_status);
    }

    public function test_admin_can_view_all_users_in_kyc_index(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        User::factory()->create(['name' => 'Pending User', 'kyc_status' => 'pending']);
        User::factory()->create(['name' => 'Unsubmitted User', 'kyc_status' => 'unsubmitted']);
        User::factory()->create(['name' => 'Verified User', 'kyc_status' => 'verified']);

        // Check status=all
        $res = $this->actingAsSession($admin)->getJson('/api/v1/securegate/kyc?status=all');
        $res->assertStatus(200);
        $this->assertGreaterThanOrEqual(3, count($res->json('data.data')));

        // Check status=unsubmitted
        $unsubmittedRes = $this->actingAsSession($admin)->getJson('/api/v1/securegate/kyc?status=unsubmitted');
        $unsubmittedRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, count($unsubmittedRes->json('data.data')));
    }
}

