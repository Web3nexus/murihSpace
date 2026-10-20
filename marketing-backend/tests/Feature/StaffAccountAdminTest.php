<?php

namespace Tests\Feature;

use App\Jobs\SyncStaffAccountJob;
use App\Models\AuditLog;
use App\Models\StaffUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class StaffAccountAdminTest extends TestCase
{
    use RefreshDatabase;

    private function tokenFor(StaffUser $staff): string
    {
        return $staff->createToken('test', ['staff'], now()->addHour())->plainTextToken;
    }

    private function superAdmin(): StaffUser
    {
        return StaffUser::factory()->superAdmin()->create(['email' => 'root@example.test']);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'New Agent',
            'email' => 'New.Agent@example.test',
            'role' => 'support_agent',
            'password' => 'brand-new-pass-99',
        ], $overrides);
    }

    public function test_non_super_admin_staff_cannot_manage_accounts(): void
    {
        $agent = StaffUser::factory()->create();
        Queue::fake();

        $this->withToken($this->tokenFor($agent))
            ->postJson('/api/admin/staff', $this->payload())
            ->assertStatus(403);

        Queue::assertNothingPushed();
        $this->assertDatabaseMissing('staff_users', ['email' => 'new.agent@example.test']);
    }

    public function test_unauthenticated_requests_are_rejected(): void
    {
        $this->postJson('/api/admin/staff', $this->payload())->assertStatus(401);
    }

    public function test_super_admin_creates_a_staff_account_audits_it_and_queues_a_sync(): void
    {
        $admin = $this->superAdmin();
        Queue::fake();

        $response = $this->withToken($this->tokenFor($admin))
            ->postJson('/api/admin/staff', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('data.email', 'new.agent@example.test')
            ->assertJsonPath('data.status', 'active');

        $this->assertStringNotContainsString('brand-new-pass-99', $response->getContent());
        $this->assertArrayNotHasKey('password', $response->json('data'));

        $created = StaffUser::where('email', 'new.agent@example.test')->firstOrFail();
        $this->assertTrue(password_verify('brand-new-pass-99', $created->password));
        $this->assertNotSame('brand-new-pass-99', $created->password);

        Queue::assertPushed(SyncStaffAccountJob::class, fn (SyncStaffAccountJob $job) => $job->staffUserId === $created->id);

        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::STAFF_ACCOUNT_CREATE,
            'staff_user_id' => $admin->id,
            'subject_id' => $created->id,
        ]);
    }

    public function test_create_rejects_duplicate_email_and_unknown_role(): void
    {
        $admin = $this->superAdmin();
        StaffUser::factory()->create(['email' => 'taken@example.test']);

        $this->withToken($this->tokenFor($admin))
            ->postJson('/api/admin/staff', $this->payload(['email' => 'taken@example.test']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');

        $this->withToken($this->tokenFor($admin))
            ->postJson('/api/admin/staff', $this->payload(['role' => 'made_up_role']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('role');
    }

    public function test_update_is_audited_and_queues_a_sync(): void
    {
        $admin = $this->superAdmin();
        $agent = StaffUser::factory()->create(['name' => 'Old Name']);
        Queue::fake();

        $this->withToken($this->tokenFor($admin))
            ->patchJson('/api/admin/staff/'.$agent->id, ['name' => 'New Name', 'role' => 'senior_agent'])
            ->assertOk()
            ->assertJsonPath('data.name', 'New Name');

        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::STAFF_ACCOUNT_UPDATE,
            'subject_id' => $agent->id,
        ]);
        Queue::assertPushed(SyncStaffAccountJob::class, 1);
    }

    public function test_disable_revokes_tokens_blocks_login_audits_and_queues_a_sync(): void
    {
        $admin = $this->superAdmin();
        $agent = StaffUser::factory()->create(['email' => 'agent@example.test', 'password' => 'agent-pass-123']);
        $agentToken = $this->tokenFor($agent);
        Queue::fake();

        $this->withToken($this->tokenFor($admin))
            ->postJson('/api/admin/staff/'.$agent->id.'/disable')
            ->assertOk()
            ->assertJsonPath('data.status', 'disabled');

        $agent->refresh();
        $this->assertFalse($agent->is_active);
        $this->assertSame(0, PersonalAccessToken::query()->where('tokenable_id', $agent->id)->count());
        $this->assertDatabaseHas('audit_logs', ['action' => AuditLog::STAFF_ACCOUNT_DISABLE, 'subject_id' => $agent->id]);
        Queue::assertPushed(SyncStaffAccountJob::class, 1);

        $this->postJson('/api/staff/login', ['email' => 'agent@example.test', 'password' => 'agent-pass-123'])
            ->assertStatus(401);

        $this->app['auth']->forgetGuards();
        $this->withToken($agentToken)->postJson('/api/staff/logout')->assertStatus(401);
    }

    public function test_enable_restores_access_and_clears_the_lock(): void
    {
        $admin = $this->superAdmin();
        $agent = StaffUser::factory()->inactive()->locked()->create(['email' => 'agent@example.test', 'password' => 'agent-pass-123']);
        Queue::fake();

        $this->withToken($this->tokenFor($admin))
            ->postJson('/api/admin/staff/'.$agent->id.'/enable')
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $agent->refresh();
        $this->assertNull($agent->locked_until);
        $this->assertSame(0, $agent->failed_login_attempts);
        $this->assertDatabaseHas('audit_logs', ['action' => AuditLog::STAFF_ACCOUNT_ENABLE, 'subject_id' => $agent->id]);

        $this->postJson('/api/staff/login', ['email' => 'agent@example.test', 'password' => 'agent-pass-123'])
            ->assertOk();
    }

    public function test_super_admin_cannot_disable_their_own_account(): void
    {
        $admin = $this->superAdmin();

        $this->withToken($this->tokenFor($admin))
            ->postJson('/api/admin/staff/'.$admin->id.'/disable')
            ->assertStatus(422);

        $this->assertSame(StaffUser::STATUS_ACTIVE, $admin->fresh()->status);
    }

    public function test_listing_never_exposes_password_or_two_factor_secret(): void
    {
        $admin = $this->superAdmin();
        StaffUser::factory()->create(['two_factor_secret' => 'JBSWY3DPEHPK3PXP', 'two_factor_confirmed_at' => now()]);

        $response = $this->withToken($this->tokenFor($admin))->getJson('/api/admin/staff')->assertOk();

        $this->assertStringNotContainsString('JBSWY3DPEHPK3PXP', $response->getContent());
        $this->assertStringNotContainsString('"password"', $response->getContent());
        $this->assertTrue(collect($response->json('data'))->contains(fn ($row) => $row['has_two_factor'] === true));
    }
}
