<?php

namespace Tests\Feature;

use App\Models\AccountRoleHistory;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleUpgradeTest extends TestCase
{
    use RefreshDatabase;

    public function test_permission_service_roles_map(): void
    {
        $this->assertTrue(PermissionService::roleHas('creator', 'community.create'));
        $this->assertFalse(PermissionService::roleHas('vendor', 'community.create'));
        $this->assertFalse(PermissionService::roleHas('member', 'storefront.manage'));
        $this->assertTrue(PermissionService::roleHas('vendor', 'storefront.manage'));
        $this->assertTrue(PermissionService::roleHas('admin', 'community.create'));
    }

    public function test_user_can_check_permissions(): void
    {
        $member = User::factory()->create(['role' => 'member']);
        $creator = User::factory()->create(['role' => 'creator']);
        $admin = User::factory()->create(['role' => 'admin']);

        $this->assertFalse($member->can('community.create'));
        $this->assertTrue($creator->can('community.create'));
        $this->assertTrue($admin->can('community.create'));
    }

    public function test_user_can_apply_for_creator_role(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/role/apply', [
                'requested_role' => 'creator',
            ]);

        $response->assertStatus(201)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('account_role_history', [
            'user_id' => $user->id,
            'previous_role' => 'member',
            'requested_role' => 'creator',
            'status' => 'pending',
        ]);
    }

    public function test_user_cannot_apply_twice_when_pending(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        AccountRoleHistory::create([
            'user_id' => $user->id,
            'previous_role' => 'member',
            'requested_role' => 'creator',
            'status' => 'pending',
            'requested_at' => now(),
        ]);

        $response = $this->actingAs($user)
            ->postJson('/api/v1/role/apply', [
                'requested_role' => 'vendor',
            ]);

        $response->assertStatus(422)
            ->assertJson(['success' => false]);
    }

    public function test_admin_can_approve_role_application(): void
    {
        $user = User::factory()->create(['role' => 'member']);
        $admin = User::factory()->create(['role' => 'admin']);

        $app = AccountRoleHistory::create([
            'user_id' => $user->id,
            'previous_role' => 'member',
            'requested_role' => 'creator',
            'status' => 'pending',
            'requested_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->patchJson("/api/v1/securegate/role-applications/{$app->id}/approve");

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertEquals('creator', $user->fresh()->role);
        $this->assertEquals('approved', $app->fresh()->status);
        $this->assertEquals($admin->id, $app->fresh()->approved_by);
    }

    public function test_admin_can_reject_role_application(): void
    {
        $user = User::factory()->create(['role' => 'member']);
        $admin = User::factory()->create(['role' => 'admin']);

        $app = AccountRoleHistory::create([
            'user_id' => $user->id,
            'previous_role' => 'member',
            'requested_role' => 'vendor',
            'status' => 'pending',
            'requested_at' => now(),
        ]);

        $response = $this->actingAs($admin)
            ->patchJson("/api/v1/securegate/role-applications/{$app->id}/reject", [
                'reason' => 'Identity verification documents were not provided.',
            ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertEquals('member', $user->fresh()->role);
        $this->assertEquals('rejected', $app->fresh()->status);
    }
}
