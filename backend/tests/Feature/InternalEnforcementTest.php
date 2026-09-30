<?php

namespace Tests\Feature;

use App\Enums\AdminPermission;
use App\Enums\AdminRole;
use App\Models\Post;
use App\Models\Report;
use App\Models\User;
use App\Models\UserWarning;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

/**
 * Cross-service enforcement from the marketing/support backend (DEC-011).
 *
 * The internal token proves which service is calling, not which human. These
 * tests cover the cases that fall out of that: a caller that names no staff
 * member, a staff member who is not an administrator here, a staff member who
 * holds user management but not enforcement, and the warning gate being
 * identical to the one the console meets.
 */
class InternalEnforcementTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-internal-token';

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('internal.token', self::TOKEN);
        Config::set('internal.allowed_ips', []);
        Config::set('internal.replay_window', 300);
        Config::set('internal.rate_limit', ['attempts' => 300, 'decay' => 60]);
        RateLimiter::clear('internal-api:'.sha1(self::TOKEN));
    }

    private function headers(): array
    {
        return [
            'X-Internal-Token' => self::TOKEN,
            'X-Timestamp' => (string) now()->getTimestamp(),
            'X-Nonce' => bin2hex(random_bytes(16)),
            'Accept' => 'application/json',
        ];
    }

    private function staff(AdminRole $role = AdminRole::ComplianceAdmin): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'admin_role' => $role->value,
            'status' => 'active',
        ]);
    }

    public function test_a_staff_member_can_warn_through_the_internal_api(): void
    {
        $staff = $this->staff();
        $member = User::factory()->create();

        $this->postJson('/internal/enforcement/warn', [
            'actor_email' => $staff->email,
            'user_id' => $member->id,
            'reason' => 'Abusive language in a support thread.',
        ], $this->headers())->assertCreated();

        $this->assertDatabaseHas('user_warnings', [
            'user_id' => $member->id,
            'reason' => 'Abusive language in a support thread.',
        ]);
    }

    public function test_the_ban_gate_applies_to_the_internal_api_exactly_as_it_does_to_the_console(): void
    {
        $staff = $this->staff();
        $member = User::factory()->create();

        $this->postJson('/internal/enforcement/ban', [
            'actor_email' => $staff->email,
            'user_id' => $member->id,
            'reason' => 'Attempted ban with no warning.',
        ], $this->headers())
            ->assertStatus(422)
            ->assertJsonPath('errors.code', 'warning_required');

        $this->assertSame('active', $member->refresh()->status);
    }

    public function test_a_ban_succeeds_once_a_warning_exists(): void
    {
        $staff = $this->staff();
        $member = User::factory()->create();

        $this->postJson('/internal/enforcement/warn', [
            'actor_email' => $staff->email,
            'user_id' => $member->id,
            'reason' => 'First warning.',
        ], $this->headers())->assertCreated();

        $this->postJson('/internal/enforcement/ban', [
            'actor_email' => $staff->email,
            'user_id' => $member->id,
            'reason' => 'Escalation.',
        ], $this->headers())->assertOk();

        $this->assertSame('banned', $member->refresh()->status);
    }

    public function test_the_response_reports_the_main_backend_state_as_the_authority(): void
    {
        $staff = $this->staff();
        $member = User::factory()->create();

        UserWarning::create([
            'user_id' => $member->id,
            'issued_by' => $staff->id,
            'reason' => 'Warning on file.',
            'category' => 'conduct',
            'expires_at' => now()->addDays(30),
        ]);

        $this->postJson('/internal/enforcement/ban', [
            'actor_email' => $staff->email,
            'user_id' => $member->id,
            'reason' => 'Escalation.',
        ], $this->headers())
            ->assertOk()
            // The caller is expected to render this rather than assume a local
            // value; it is the reconciliation point of DEC-011.
            ->assertJsonPath('data.status', 'banned');
    }

    public function test_a_caller_that_names_a_non_administrator_is_refused(): void
    {
        $member = User::factory()->create();
        $target = User::factory()->create();

        $this->postJson('/internal/enforcement/warn', [
            'actor_email' => $member->email,
            'user_id' => $target->id,
            'reason' => 'I am not staff.',
        ], $this->headers())->assertStatus(403);

        $this->assertDatabaseMissing('user_warnings', ['user_id' => $target->id]);
    }

    public function test_a_staff_member_without_the_warnings_permission_is_refused(): void
    {
        $supportStaff = $this->staff(AdminRole::SupportStaff);
        $target = User::factory()->create();

        $this->postJson('/internal/enforcement/ban', [
            'actor_email' => $supportStaff->email,
            'user_id' => $target->id,
            'reason' => 'Not my lane.',
        ], $this->headers())->assertStatus(403);

        $this->assertSame('active', $target->refresh()->status);
    }

    public function test_an_inactive_administrator_is_refused(): void
    {
        $staff = $this->staff();
        $staff->update(['status' => 'banned']);
        $target = User::factory()->create();

        $this->postJson('/internal/enforcement/warn', [
            'actor_email' => $staff->email,
            'user_id' => $target->id,
            'reason' => 'From a disabled account.',
        ], $this->headers())->assertStatus(403);
    }

    public function test_the_acting_staff_member_is_recorded_as_the_audit_actor(): void
    {
        $staff = $this->staff();
        $target = User::factory()->create();

        UserWarning::create([
            'user_id' => $target->id,
            'issued_by' => $staff->id,
            'reason' => 'Warning on file.',
            'category' => 'conduct',
            'expires_at' => now()->addDays(30),
        ]);

        $this->postJson('/internal/enforcement/ban', [
            'actor_email' => $staff->email,
            'user_id' => $target->id,
            'reason' => 'Escalation.',
        ], $this->headers())->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.banned',
            'user_id' => $staff->id,
            'resource_id' => (string) $target->id,
        ]);
    }

    public function test_a_missing_actor_is_rejected_by_validation(): void
    {
        $this->postJson('/internal/enforcement/warn', [
            'user_id' => 1,
            'reason' => 'No actor named.',
        ], $this->headers())->assertStatus(422);
    }

    public function test_a_report_can_be_flagged_from_the_support_console(): void
    {
        $staff = $this->staff();
        $post = Post::factory()->create();
        $report = Report::create([
            'reporter_id' => User::factory()->create()->id,
            'reported_type' => 'post',
            'reported_id' => $post->id,
            'reason' => 'spam',
            'status' => 'pending',
        ]);

        $this->postJson('/internal/enforcement/flag-report', [
            'actor_email' => $staff->email,
            'report_id' => $report->id,
            'flag_note' => 'Raised by a support agent.',
        ], $this->headers())->assertOk();

        $report->refresh();

        $this->assertSame('flagged', $report->status);
        $this->assertSame($staff->id, $report->flagged_by);
    }

    public function test_the_internal_token_is_still_required(): void
    {
        $staff = $this->staff();
        $target = User::factory()->create();

        // Same contract as the rest of the internal API: a bad token is
        // refused before the body is ever looked at.
        $this->postJson('/internal/enforcement/warn', [
            'actor_email' => $staff->email,
            'user_id' => $target->id,
            'reason' => 'No internal credentials.',
        ], array_merge($this->headers(), ['X-Internal-Token' => 'wrong-token']))
            ->assertStatus(403);

        $this->assertDatabaseMissing('user_warnings', ['user_id' => $target->id]);
    }
}
