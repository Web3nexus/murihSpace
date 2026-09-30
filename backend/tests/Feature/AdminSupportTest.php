<?php

namespace Tests\Feature;

use App\Enums\AdminRole;
use App\Models\SupportMessage;
use App\Models\SupportThread;
use App\Models\User;
use App\Support\AdminSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * Administration view of member support threads.
 *
 * The `support` permission owned a navigation section with no route behind it,
 * so a Support Admin was shown an area that could not load. These tests cover
 * the queue, the reply path, and that the permission is actually enforced.
 */
class AdminSupportTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function admin(AdminRole $role): User
    {
        return User::factory()->create(['role' => 'admin', 'admin_role' => $role->value]);
    }

    public function test_support_admin_can_list_threads_from_any_member(): void
    {
        // The suite's database is seeded with threads, so assertions target the
        // records this test creates rather than an absolute queue size.
        $member = User::factory()->create();
        SupportThread::create(['user_id' => $member->id, 'subject' => 'QA open subject', 'status' => 'open']);
        SupportThread::create(['user_id' => $member->id, 'subject' => 'QA resolved subject', 'status' => 'resolved']);

        $this->signIn($this->admin(AdminRole::SupportAdmin));

        $open = $this->getJson('/api/v1/securegate/support/threads?status=open&search=QA%20open%20subject');
        $open->assertOk();
        $this->assertCount(1, $open->json('data.data'));
        $this->assertSame('QA open subject', $open->json('data.data.0.subject'));

        // The status filter is honoured, not just the search.
        $this->getJson('/api/v1/securegate/support/threads?status=open&search=QA%20resolved%20subject')
            ->assertOk()
            ->assertJsonCount(0, 'data.data');
    }

    public function test_thread_list_is_not_scoped_to_the_requesting_administrator(): void
    {
        // The consumer controller scopes to `where user_id = auth id`, which
        // for an administrator would return nothing. The admin queue must see
        // every member's threads.
        $memberA = User::factory()->create();
        $memberB = User::factory()->create();
        SupportThread::create(['user_id' => $memberA->id, 'subject' => 'QA scope A', 'status' => 'open']);
        SupportThread::create(['user_id' => $memberB->id, 'subject' => 'QA scope B', 'status' => 'open']);

        $this->signIn($this->admin(AdminRole::SupportAdmin));

        $response = $this->getJson('/api/v1/securegate/support/threads?search=QA%20scope');

        $response->assertOk();
        $this->assertCount(2, $response->json('data.data'));
        $this->assertEqualsCanonicalizing(
            [$memberA->id, $memberB->id],
            collect($response->json('data.data'))->pluck('user_id')->all(),
        );
    }

    public function test_kyc_admin_cannot_reach_the_support_queue(): void
    {
        $this->signIn($this->admin(AdminRole::KycAdmin));

        $this->getJson('/api/v1/securegate/support/threads')->assertForbidden();
    }

    public function test_support_admin_cannot_process_withdrawals(): void
    {
        // The §21 example, in the direction that matters: support reach must
        // not leak into money movement.
        $this->signIn($this->admin(AdminRole::SupportAdmin));

        $this->getJson('/api/v1/securegate/withdrawals')->assertForbidden();
        $this->getJson('/api/v1/securegate/payments')->assertForbidden();
    }

    public function test_reply_is_recorded_as_coming_from_an_administrator(): void
    {
        config(['services.legacy_support_threads.enabled' => true]);

        $member = User::factory()->create();
        $thread = SupportThread::create([
            'user_id' => $member->id,
            'subject' => 'Withdrawal stuck',
            'status' => 'open',
        ]);

        $this->signIn($this->admin(AdminRole::SupportAdmin));

        $this->postJson("/api/v1/securegate/support/threads/{$thread->id}/reply", [
            'content' => 'We are looking into it.',
        ])
            ->assertCreated()
            ->assertJsonPath('message.from_admin', true);

        $this->assertDatabaseHas('support_messages', [
            'thread_id' => $thread->id,
            'from_admin' => true,
            'content' => 'We are looking into it.',
        ]);
    }

    public function test_replying_to_a_resolved_thread_reopens_it(): void
    {
        config(['services.legacy_support_threads.enabled' => true]);

        $member = User::factory()->create();
        $thread = SupportThread::create([
            'user_id' => $member->id,
            'subject' => 'Follow up',
            'status' => 'resolved',
        ]);

        $this->signIn($this->admin(AdminRole::SupportAdmin));

        $this->postJson("/api/v1/securegate/support/threads/{$thread->id}/reply", [
            'content' => 'One more thing.',
        ])->assertCreated();

        // Otherwise the member's new question disappears from an
        // open-queue filter the moment it is asked.
        $this->assertSame('open', $thread->fresh()->status);
    }

    public function test_status_can_be_changed_but_only_to_a_known_value(): void
    {
        $member = User::factory()->create();
        $thread = SupportThread::create([
            'user_id' => $member->id,
            'subject' => 'Anything',
            'status' => 'open',
        ]);

        $this->signIn($this->admin(AdminRole::SupportAdmin));

        $this->patchJson("/api/v1/securegate/support/threads/{$thread->id}", [
            'status' => 'resolved',
        ])->assertOk();

        $this->assertSame('resolved', $thread->fresh()->status);

        $this->patchJson("/api/v1/securegate/support/threads/{$thread->id}", [
            'status' => 'exploded',
        ])->assertStatus(422);
    }

    public function test_counts_summarise_the_queue(): void
    {
        $member = User::factory()->create();
        SupportThread::create(['user_id' => $member->id, 'subject' => 'QA A', 'status' => 'open']);
        SupportThread::create(['user_id' => $member->id, 'subject' => 'QA B', 'status' => 'open']);
        SupportThread::create(['user_id' => $member->id, 'subject' => 'QA C', 'status' => 'closed']);

        $this->signIn($this->admin(AdminRole::SupportAdmin));

        $counts = $this->getJson('/api/v1/securegate/support/threads/counts')->assertOk();

        // Seeded threads exist, so this asserts the three added here are
        // reflected rather than that the queue holds exactly three.
        $this->assertSame(SupportThread::where('status', 'open')->count(), $counts->json('data.open'));
        $this->assertSame(SupportThread::where('status', 'closed')->count(), $counts->json('data.closed'));
        $this->assertSame(SupportThread::count(), $counts->json('data.all'));
        $this->assertGreaterThanOrEqual(2, $counts->json('data.open'));
    }

    public function test_a_consumer_session_is_refused_the_support_queue(): void
    {
        $member = User::factory()->create(['role' => 'member']);
        SupportThread::create(['user_id' => $member->id, 'subject' => 'Mine', 'status' => 'open']);

        $this->signIn($member);

        $this->getJson('/api/v1/securegate/support/threads')->assertForbidden();
    }

    public function test_last_message_is_available_without_loading_every_message(): void
    {
        $member = User::factory()->create();
        $thread = SupportThread::create([
            'user_id' => $member->id,
            'subject' => 'Long thread',
            'status' => 'open',
        ]);

        SupportMessage::create(['thread_id' => $thread->id, 'user_id' => $member->id, 'content' => 'first']);
        SupportMessage::create(['thread_id' => $thread->id, 'user_id' => $member->id, 'content' => 'second']);
        SupportMessage::create(['thread_id' => $thread->id, 'user_id' => $member->id, 'content' => 'most recent']);

        $this->signIn($this->admin(AdminRole::SupportAdmin));

        $response = $this->getJson('/api/v1/securegate/support/threads?search=Long%20thread');

        $response->assertOk()->assertJsonCount(1, 'data.data');
        $this->assertSame(3, $response->json('data.data.0.messages_count'));
        $this->assertSame('most recent', $response->json('data.data.0.last_message.content'));
    }

    private function signIn(User $user): static
    {
        return $this->actAsSession($user, ['*', AdminSession::ABILITY_MFA]);
    }
}
