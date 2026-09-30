<?php

namespace Tests\Feature;

use App\Enums\AdminRole;
use App\Models\AuditLog;
use App\Models\User;
use App\Models\UserWarning;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * The warning gate required before a member may be banned (DEC-012).
 *
 * The gate lives in the main backend on purpose: a client-side check could be
 * skipped by the internal API, and the marketing backend reaches the same
 * service. These tests therefore exercise the server, not the console.
 */
class UserEnforcementTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function admin(AdminRole $role = AdminRole::ComplianceAdmin): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'admin_role' => $role->value,
            'status' => 'active',
        ]);
    }

    private function member(): User
    {
        return User::factory()->create(['role' => 'member', 'status' => 'active']);
    }

    private function authAdmin(): array
    {
        $admin = $this->admin();

        return [$admin, $this->actingAsSession($admin)];
    }

    public function test_a_ban_is_rejected_when_no_warning_is_on_record(): void
    {
        [, $acting] = $this->authAdmin();
        $member = $this->member();

        $response = $acting->postJson("/api/v1/securegate/enforcement/users/{$member->id}/ban", [
            'reason' => 'Repeated harassment.',
        ]);

        $response->assertStatus(422)->assertJsonPath('errors.code', 'warning_required');
        $this->assertSame('active', $member->refresh()->status);
    }

    public function test_a_ban_succeeds_once_an_unexpired_warning_exists(): void
    {
        [$admin, $acting] = $this->authAdmin();
        $member = $this->member();

        $acting->postJson("/api/v1/securegate/enforcement/users/{$member->id}/warn", [
            'reason' => 'Posting abusive comments.',
            'valid_for_days' => 30,
        ])->assertCreated();

        $acting->postJson("/api/v1/securegate/enforcement/users/{$member->id}/ban", [
            'reason' => 'Continued harassment after a warning.',
        ])->assertOk();

        $this->assertSame('banned', $member->refresh()->status);
    }

    public function test_an_expired_warning_does_not_satisfy_the_gate(): void
    {
        [, $acting] = $this->authAdmin();
        $member = $this->member();

        UserWarning::create([
            'user_id' => $member->id,
            'issued_by' => $this->admin()->id,
            'reason' => 'Old warning.',
            'category' => 'conduct',
            'expires_at' => now()->subDay(),
        ]);

        $acting->postJson("/api/v1/securegate/enforcement/users/{$member->id}/ban", [
            'reason' => 'Attempted ban with a lapsed warning.',
        ])->assertStatus(422)->assertJsonPath('errors.code', 'warning_required');

        $this->assertSame('active', $member->refresh()->status);
    }

    public function test_a_revoked_warning_does_not_satisfy_the_gate(): void
    {
        [$admin, $acting] = $this->authAdmin();
        $member = $this->member();

        $warning = UserWarning::create([
            'user_id' => $member->id,
            'issued_by' => $admin->id,
            'reason' => 'Warning issued in error.',
            'category' => 'conduct',
            'expires_at' => now()->addDays(30),
        ]);

        $acting->deleteJson("/api/v1/securegate/users/{$member->id}/warnings/{$warning->id}")
            ->assertOk();

        $acting->postJson("/api/v1/securegate/enforcement/users/{$member->id}/ban", [
            'reason' => 'Ban attempted after the warning was withdrawn.',
        ])->assertStatus(422)->assertJsonPath('errors.code', 'warning_required');
    }

    public function test_an_emergency_ban_is_permitted_without_a_warning_and_is_audited(): void
    {
        [$admin, $acting] = $this->authAdmin();
        $member = $this->member();

        $acting->postJson("/api/v1/securegate/enforcement/users/{$member->id}/ban", [
            'reason' => 'Active payment fraud in progress.',
            'ban_type' => 'emergency',
        ])->assertOk();

        $this->assertSame('banned', $member->refresh()->status);
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.banned',
            'resource_id' => (string) $member->id,
            'user_id' => $admin->id,
        ]);

        $log = AuditLog::where('action', 'user.banned')
            ->where('resource_id', (string) $member->id)
            ->firstOrFail();

        $this->assertSame('emergency', $log->metadata['ban_type']);
    }

    public function test_warning_history_reports_whether_a_ban_is_permitted(): void
    {
        [, $acting] = $this->authAdmin();
        $member = $this->member();

        $acting->getJson("/api/v1/securegate/users/{$member->id}/warnings")
            ->assertOk()
            ->assertJsonPath('data.meta.can_ban', false);

        $acting->postJson("/api/v1/securegate/enforcement/users/{$member->id}/warn", [
            'reason' => 'Spam in the community feed.',
        ])->assertCreated();

        $response = $acting->getJson("/api/v1/securegate/users/{$member->id}/warnings")->assertOk();

        $response->assertJsonPath('data.meta.can_ban', true);
        $this->assertCount(1, $response->json('data.data'));
        $this->assertTrue($response->json('data.data.0.active'));
        $this->assertSame(30, $response->json('data.data.0.days_remaining'));
    }

    public function test_the_ban_names_the_warning_it_relied_on(): void
    {
        [, $acting] = $this->authAdmin();
        $member = $this->member();

        $warningId = $acting->postJson("/api/v1/securegate/enforcement/users/{$member->id}/warn", [
            'reason' => 'Threatening language in a comment.',
        ])->assertCreated()->json('data.data.id');

        $acting->postJson("/api/v1/securegate/enforcement/users/{$member->id}/ban", [
            'reason' => 'Escalation after warning.',
        ])->assertOk();

        $this->assertSame(
            (string) $member->id,
            UserWarning::find($warningId)->ban_id,
        );
    }

    public function test_enforcement_requires_the_warnings_permission(): void
    {
        $moderatorOnly = $this->admin(AdminRole::Moderator);
        $member = $this->member();

        // A moderator holds `warnings` but not `users`; the enforcement routes
        // must be reachable, proving the gate is the new permission alone.
        $warnRes = $this->actingAsSession($moderatorOnly)
            ->postJson("/api/v1/securegate/enforcement/users/{$member->id}/warn", [
                'reason' => 'Content policy violation.',
            ])
            ->assertCreated();

        $warningId = $warnRes->json('data.data.id');

        $this->actingAsSession($moderatorOnly)
            ->getJson("/api/v1/securegate/enforcement/users/{$member->id}/warnings")
            ->assertOk();

        $this->actingAsSession($moderatorOnly)
            ->deleteJson("/api/v1/securegate/enforcement/users/{$member->id}/warnings/{$warningId}")
            ->assertOk();
    }

    public function test_a_non_admin_cannot_issue_a_warning(): void
    {
        $member = $this->member();
        $target = $this->member();

        $this->actingAsSession($member)
            ->postJson("/api/v1/securegate/enforcement/users/{$target->id}/warn", [
                'reason' => 'I do not like them.',
            ])
            ->assertForbidden();
    }

    public function test_a_user_holder_cannot_ban_without_the_warnings_permission(): void
    {
        $supportStaff = $this->admin(AdminRole::SupportStaff);
        $member = $this->member();

        $this->actingAsSession($supportStaff)
            ->postJson("/api/v1/securegate/enforcement/users/{$member->id}/ban", [
                'reason' => 'Not my lane.',
            ])
            ->assertForbidden();
    }
}
