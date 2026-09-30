<?php

namespace Tests\Feature;

use App\Models\ModerationRule;
use App\Models\ModerationRuleLog;
use App\Models\Post;
use App\Models\PostComment;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * The content monitor and the flag action (DEC-013).
 *
 * The property under test throughout is that detection only ever *queues*.
 * A rule that matches aggressively must not be able to remove content, restrict
 * an author or change any member's standing — that is the whole reason a human
 * is in the loop.
 */
class ContentMonitorTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function rule(array $overrides = []): ModerationRule
    {
        return ModerationRule::create(array_merge([
            'name' => 'Test rule',
            'category' => 'harassment',
            'severity' => 'medium',
            'match_type' => 'keyword',
            'patterns' => ['forbidden phrase'],
            'enabled' => true,
        ], $overrides));
    }

    public function test_a_matching_post_is_queued_for_review(): void
    {
        $this->rule();
        $author = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $author->id]);

        $post->update(['content' => 'This contains a forbidden phrase in it.']);

        app(\App\Services\ContentMonitor::class)
            ->scan('post', $post->id, $author->id, (string) $post->content);

        $this->assertDatabaseHas('reports', [
            'reported_type' => 'post',
            'reported_id' => $post->id,
            'reason' => 'harassment',
            'status' => 'flagged',
        ]);

        $this->assertDatabaseHas('moderation_rule_logs', [
            'content_type' => 'post',
            'content_id' => $post->id,
            'author_id' => $author->id,
        ]);
    }

    public function test_a_match_never_removes_the_content_or_touches_the_author(): void
    {
        $this->rule();
        $author = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $author->id]);
        $post->update(['content' => 'forbidden phrase']);

        app(\App\Services\ContentMonitor::class)
            ->scan('post', $post->id, $author->id, (string) $post->content);

        $this->assertNull($post->fresh()->deleted_at, 'The monitor must not delete content.');
        $this->assertSame('active', $author->fresh()->status, 'The monitor must not change member standing.');
        $this->assertDatabaseMissing('user_warnings', ['user_id' => $author->id]);
    }

    public function test_a_disabled_rule_never_fires(): void
    {
        $this->rule(['enabled' => false]);

        $reportCount = app(\App\Services\ContentMonitor::class)
            ->scan('post', 1, null, 'a forbidden phrase here');

        $this->assertSame([], $reportCount);
        $this->assertSame(0, Report::count());
    }

    public function test_a_rule_scoped_to_comments_ignores_posts(): void
    {
        $this->rule(['applies_to' => ['comment']]);

        $reports = app(\App\Services\ContentMonitor::class)
            ->scan('post', 1, null, 'a forbidden phrase here');

        $this->assertSame([], $reports);
    }

    public function test_matching_is_case_insensitive(): void
    {
        $this->rule();

        $reports = app(\App\Services\ContentMonitor::class)
            ->scan('post', 1, null, 'A FORBIDDEN PHRASE shouted');

        $this->assertCount(1, $reports);
    }

    public function test_a_broken_regex_does_not_match_and_does_not_crash(): void
    {
        $this->rule(['match_type' => 'regex', 'patterns' => ['([unclosed']]);

        $reports = app(\App\Services\ContentMonitor::class)
            ->scan('post', 1, null, 'some text with ([unclosed in it');

        $this->assertSame([], $reports, 'An invalid pattern must be skipped, not treated as a match.');
    }

    public function test_a_valid_regex_matches(): void
    {
        $this->rule(['match_type' => 'regex', 'patterns' => ['\bbuy\s+now\b']]);

        $reports = app(\App\Services\ContentMonitor::class)
            ->scan('post', 1, null, 'You should buy   now while stocks last');

        $this->assertCount(1, $reports);
    }

    public function test_rescanning_the_same_content_does_not_duplicate_the_report(): void
    {
        $this->rule();
        $monitor = app(\App\Services\ContentMonitor::class);

        $monitor->scan('post', 42, null, 'a forbidden phrase');
        $monitor->scan('post', 42, null, 'a forbidden phrase again');

        $this->assertSame(1, Report::count());
    }

    public function test_each_rule_produces_its_own_report(): void
    {
        $this->rule(['name' => 'Rule A']);
        $this->rule(['name' => 'Rule B']);
        $monitor = app(\App\Services\ContentMonitor::class);

        $reports = $monitor->scan('post', 7, null, 'a forbidden phrase');

        $this->assertCount(2, $reports);
    }

    public function test_empty_content_is_never_scanned(): void
    {
        $this->rule();

        $this->assertSame([], app(\App\Services\ContentMonitor::class)->scan('post', 1, null, '   '));
    }

    public function test_rule_precision_is_null_until_a_moderator_has_ruled(): void
    {
        $rule = $this->rule();

        $this->assertNull($rule->precision());

        $rule->recordVerdict(true);
        $rule->recordVerdict(true);
        $rule->recordVerdict(false);

        $this->assertEqualsWithDelta(2 / 3, $rule->precision(), 0.001);
    }

    public function test_adding_a_comment_with_a_match_queues_it(): void
    {
        $this->rule();
        $author = User::factory()->create();
        $post = Post::factory()->create();
        $comment = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $author->id,
            'content' => 'a forbidden phrase',
        ]);

        app(\App\Services\ContentMonitor::class)
            ->scan('comment', $comment->id, $author->id, (string) $comment->content);

        $this->assertDatabaseHas('reports', [
            'reported_type' => 'comment',
            'reported_id' => $comment->id,
            'status' => 'flagged',
        ]);
    }

    public function test_a_member_can_now_report_a_comment(): void
    {
        $reporter = User::factory()->create();
        $author = User::factory()->create();
        $post = Post::factory()->create(['user_id' => $author->id]);
        $comment = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $author->id,
            'content' => 'something objectionable',
        ]);

        $this->actingAsSession($reporter)
            ->postJson("/api/v1/posts/{$post->id}/comments/{$comment->id}/report", [
                'reason' => 'harassment',
                'description' => 'This comment targets me.',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('reports', [
            'reporter_id' => $reporter->id,
            'reported_type' => 'comment',
            'reported_id' => $comment->id,
            'reason' => 'harassment',
            'status' => 'pending',
        ]);
    }

    public function test_a_member_cannot_report_the_same_comment_twice_while_it_is_pending(): void
    {
        $reporter = User::factory()->create();
        $post = Post::factory()->create();
        $comment = PostComment::create([
            'post_id' => $post->id,
            'user_id' => $post->user_id,
            'content' => 'something',
        ]);

        $this->actingAsSession($reporter)
            ->postJson("/api/v1/posts/{$post->id}/comments/{$comment->id}/report", ['reason' => 'spam'])
            ->assertCreated();

        $this->actingAsSession($reporter)
            ->postJson("/api/v1/posts/{$post->id}/comments/{$comment->id}/report", ['reason' => 'spam'])
            ->assertStatus(409);
    }

    public function test_a_member_post_report_reaches_the_moderation_queue(): void
    {
        $reporter = User::factory()->create();
        $post = Post::factory()->create();

        $this->actingAsSession($reporter)
            ->postJson("/api/v1/posts/{$post->id}/report", [
                'reason' => 'hate_speech',
                'description' => 'This is a safety concern.',
            ])
            ->assertCreated();

        $this->assertDatabaseHas('reports', [
            'reporter_id' => $reporter->id,
            'reported_type' => 'post',
            'reported_id' => $post->id,
            'reason' => 'hate_speech',
            'status' => 'pending',
        ]);

        // The whole point of DEC-014: the queue reads `reports`, so a member
        // report has to appear there or it is invisible to moderators.
        $this->assertSame(1, Report::where('reported_type', 'post')->where('reported_id', $post->id)->count());
    }

    public function test_rule_log_records_the_snippet_and_matched_pattern(): void
    {
        $rule = $this->rule();
        $monitor = app(\App\Services\ContentMonitor::class);

        $monitor->scan('post', 5, null, 'lots of text before a forbidden phrase and lots after');

        $log = ModerationRuleLog::firstOrFail();

        $this->assertSame($rule->id, $log->rule_id);
        $this->assertSame('forbidden phrase', $log->matched_pattern);
        $this->assertStringContainsString('forbidden phrase', (string) $log->snippet);
    }
}
