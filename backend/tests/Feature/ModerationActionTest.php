<?php

namespace Tests\Feature;

use App\Enums\AdminRole;
use App\Models\ModerationRule;
use App\Models\Post;
use App\Models\Report;
use App\Models\User;
use App\Models\UserWarning;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * Moderation queue actions: flag, and the ban gate as seen from the queue.
 *
 * `ban_author` used to write `status = banned` straight onto the author. That
 * was a way around the warning gate — reach the same account through the
 * moderation queue instead of the Trust & Safety screen and no warning was
 * needed, with no audit entry and no notification. These tests pin the gate to
 * every route that can ban.
 */
class ModerationActionTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function admin(AdminRole $role = AdminRole::ContentAdmin): User
    {
        return User::factory()->create(['role' => 'admin', 'admin_role' => $role->value]);
    }

    private function reportFor(User $author, string $type = 'post'): Report
    {
        $id = $type === 'post'
            ? Post::factory()->create(['user_id' => $author->id])->id
            : $author->id;

        return Report::create([
            'reporter_id' => User::factory()->create()->id,
            'reported_type' => $type,
            'reported_id' => $id,
            'reason' => 'harassment',
            'status' => 'pending',
        ]);
    }

    public function test_flag_escalates_a_report_without_resolving_it(): void
    {
        $admin = $this->admin();
        $report = $this->reportFor(User::factory()->create());

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", [
                'action' => 'flag',
                'review_note' => 'Warrants a second look.',
            ])
            ->assertOk();

        $report->refresh();

        $this->assertSame('flagged', $report->status);
        $this->assertSame($admin->id, $report->flagged_by);
        $this->assertNotNull($report->flagged_at);
        $this->assertSame('Warrants a second look.', $report->flag_note);
        $this->assertSame(1, $report->flag_count);

        // Flagging is not a review: it must not claim the report was resolved.
        $this->assertNull($report->reviewed_by);
        $this->assertNull($report->reviewed_at);
    }

    public function test_a_flagged_report_still_counts_as_open_work(): void
    {
        $admin = $this->admin();
        $report = $this->reportFor(User::factory()->create());

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", ['action' => 'flag'])
            ->assertOk();

        $this->actingAsSession($admin)
            ->getJson('/api/v1/securegate/reports/pending-count')
            ->assertOk()
            ->assertJsonPath('data.data.flagged', 1)
            ->assertJsonPath('data.data.open', 1);
    }

    public function test_flagging_twice_increments_the_count(): void
    {
        $admin = $this->admin();
        $report = $this->reportFor(User::factory()->create());

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", ['action' => 'flag'])
            ->assertOk();

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", ['action' => 'flag'])
            ->assertOk();

        $this->assertSame(2, $report->refresh()->flag_count);
    }

    public function test_ban_author_is_refused_when_the_author_has_no_warning(): void
    {
        $admin = $this->admin();
        $author = User::factory()->create();
        $report = $this->reportFor($author);

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", [
                'action' => 'ban_author',
                'review_note' => 'Repeated abuse.',
            ])
            ->assertStatus(422);

        $this->assertSame('active', $author->refresh()->status);
    }

    public function test_a_refused_ban_leaves_the_report_open(): void
    {
        $admin = $this->admin();
        $author = User::factory()->create();
        $report = $this->reportFor($author);

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", [
                'action' => 'ban_author',
                'review_note' => 'Repeated abuse.',
            ])
            ->assertStatus(422);

        $report->refresh();

        // The report must not be marked actioned for a ban that did not happen.
        $this->assertSame('pending', $report->status);
        $this->assertNull($report->reviewed_at);
    }

    public function test_ban_author_succeeds_once_the_author_has_been_warned(): void
    {
        $admin = $this->admin();
        $author = User::factory()->create();
        $report = $this->reportFor($author);

        UserWarning::create([
            'user_id' => $author->id,
            'issued_by' => $admin->id,
            'reason' => 'Abusive comments.',
            'category' => 'harassment',
            'expires_at' => now()->addDays(30),
        ]);

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", [
                'action' => 'ban_author',
                'review_note' => 'Continued abuse after a warning.',
            ])
            ->assertOk();

        $this->assertSame('banned', $author->refresh()->status);
        $this->assertSame('actioned', $report->refresh()->status);
    }

    public function test_ban_author_through_the_queue_is_audited(): void
    {
        $admin = $this->admin();
        $author = User::factory()->create();
        $report = $this->reportFor($author);

        UserWarning::create([
            'user_id' => $author->id,
            'issued_by' => $admin->id,
            'reason' => 'Abusive comments.',
            'category' => 'harassment',
            'expires_at' => now()->addDays(30),
        ]);

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", [
                'action' => 'ban_author',
                'review_note' => 'Escalation.',
            ])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'user.banned',
            'resource_id' => (string) $author->id,
            'user_id' => $admin->id,
        ]);
    }

    public function test_an_emergency_ban_through_the_queue_is_permitted(): void
    {
        $admin = $this->admin();
        $author = User::factory()->create();
        $report = $this->reportFor($author);

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", [
                'action' => 'ban_author',
                'review_note' => 'Active fraud in progress.',
                'ban_type' => 'emergency',
            ])
            ->assertOk();

        $this->assertSame('banned', $author->refresh()->status);
    }

    public function test_delete_still_works_without_touching_member_standing(): void
    {
        $admin = $this->admin();
        $author = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $author->id]);
        $report = $this->reportFor($author, 'post');
        $report->update(['reported_id' => $post->id]);

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", [
                'action' => 'delete',
                'review_note' => 'Removed.',
            ])
            ->assertOk();

        $this->assertNotNull($post->fresh()->deleted_at);
        // Removing content is not a member sanction.
        $this->assertSame('active', $author->refresh()->status);
    }

    public function test_dismissing_a_rule_finding_counts_against_that_rule(): void
    {
        $admin = $this->admin();
        $rule = ModerationRule::create([
            'name' => 'Noisy rule',
            'category' => 'spam',
            'severity' => 'low',
            'match_type' => 'keyword',
            'patterns' => ['buy now'],
            'enabled' => true,
        ]);

        $report = $this->reportFor(User::factory()->create());
        $report->update(['details' => 'Matched "buy now". [rule:'.$rule->id.']']);

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", [
                'action' => 'dismiss',
                'review_note' => 'False positive.',
            ])
            ->assertOk();

        $this->assertSame(1, $rule->fresh()->reports_dismissed);
        $this->assertSame(0, $rule->fresh()->reports_upheld);
    }

    public function test_deleting_a_rule_finding_counts_as_upholding_it(): void
    {
        $admin = $this->admin();
        $rule = ModerationRule::create([
            'name' => 'Good rule',
            'category' => 'hate_speech',
            'severity' => 'high',
            'match_type' => 'keyword',
            'patterns' => ['bad phrase'],
            'enabled' => true,
        ]);

        $author = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $author->id]);
        $report = $this->reportFor($author, 'post');
        $report->update(['reported_id' => $post->id, 'details' => 'Matched. [rule:'.$rule->id.']']);

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", ['action' => 'delete'])
            ->assertOk();

        $this->assertSame(1, $rule->fresh()->reports_upheld);
    }

    public function test_a_member_cannot_flag_a_report(): void
    {
        $report = $this->reportFor(User::factory()->create());
        $member = User::factory()->create();

        $this->actingAsSession($member)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", ['action' => 'flag'])
            ->assertForbidden();
    }

    public function test_an_unknown_action_is_rejected(): void
    {
        $admin = $this->admin();
        $report = $this->reportFor(User::factory()->create());

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/reports/{$report->id}/action", ['action' => 'nuke'])
            ->assertStatus(422);
    }
}
