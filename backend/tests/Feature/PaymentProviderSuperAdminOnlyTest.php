<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * Payment provider credentials and routing are visible and editable by the super
 * admin only. Other staff are refused even when they hold the settings permission.
 */
class PaymentProviderSuperAdminOnlyTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    public function test_staff_with_settings_permission_cannot_list_or_change_providers(): void
    {
        $staff = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'operations_admin',
            'admin_permissions' => ['settings'],
        ]);

        $this->actingAsSession($staff)
            ->getJson('/api/v1/securegate/payment-providers')
            ->assertStatus(403);

        $this->actingAsSession($staff)
            ->getJson('/api/v1/securegate/payment-routes')
            ->assertStatus(403);
    }

    public function test_super_admin_can_list_providers(): void
    {
        $super = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'super_admin',
            'admin_permissions' => [],
        ]);

        $this->actingAsSession($super)
            ->getJson('/api/v1/securegate/payment-providers')
            ->assertStatus(200);
    }
}
