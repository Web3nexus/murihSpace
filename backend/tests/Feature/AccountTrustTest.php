<?php

namespace Tests\Feature;

use App\Models\AccountAppeal;
use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Report;
use App\Models\User;
use App\Models\UserBlock;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class AccountTrustTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function member(string $phone): User
    {
        return User::factory()->create([
            'role' => 'member',
            'email_verified_at' => now(),
            'mobile_number' => $phone,
        ]);
    }

    private function directChat(User $a, User $b): Conversation
    {
        $chat = Conversation::create(['type' => 'direct']);
        ConversationParticipant::create(['conversation_id' => $chat->id, 'user_id' => $a->id]);
        ConversationParticipant::create(['conversation_id' => $chat->id, 'user_id' => $b->id]);

        return $chat;
    }

    private function report(User $reporter, User $target): void
    {
        Sanctum::actingAs($reporter);
        $this->postJson('/api/v1/reports', [
            'reported_type' => 'user',
            'reported_id' => $target->id,
            'reason' => 'harassment',
        ])->assertStatus(201);
    }

    private function admin(string $adminRole = 'account_admin'): User
    {
        return User::factory()->create([
            'role' => 'admin',
            'admin_role' => $adminRole,
            'email_verified_at' => now(),
        ]);
    }

    // ── Clear chat ─────────────────────────────────────────────

    public function test_direct_chat_cannot_be_cleared_for_the_other_person(): void
    {
        $a = $this->member('+15550000001');
        $b = $this->member('+15550000002');
        $chat = $this->directChat($a, $b);

        Sanctum::actingAs($a);
        $this->deleteJson("/api/v1/conversations/{$chat->id}/messages?mode=everyone")
            ->assertStatus(403);

        // Clearing for yourself still works.
        $this->deleteJson("/api/v1/conversations/{$chat->id}/messages?mode=me")
            ->assertOk();
    }

    // ── Blocking ───────────────────────────────────────────────

    public function test_a_blocked_person_cannot_send_a_message_in_a_direct_chat(): void
    {
        $a = $this->member('+15550000003');
        $b = $this->member('+15550000004');
        $chat = $this->directChat($a, $b);
        UserBlock::create(['blocker_id' => $b->id, 'blocked_id' => $a->id]);

        Sanctum::actingAs($a);
        $this->postJson("/api/v1/conversations/{$chat->id}/messages", ['content' => 'Hello'])
            ->assertStatus(403)
            ->assertJsonPath('errors.code', 'BLOCKED');
    }

    // ── Automatic suspension ───────────────────────────────────

    public function test_three_different_reporters_suspend_the_account_automatically(): void
    {
        $target = $this->member('+15550000005');
        $this->report($this->member('+15550000011'), $target);
        $this->report($this->member('+15550000012'), $target);
        $this->assertSame('active', $target->fresh()->status);

        $this->report($this->member('+15550000013'), $target);
        $target->refresh();

        $this->assertSame('suspended', $target->status);
        $this->assertSame('auto_reports', $target->suspension_source);
    }

    public function test_repeat_reports_from_one_person_do_not_count_as_several(): void
    {
        $target = $this->member('+15550000006');
        $reporter = $this->member('+15550000014');

        // Only one person reports, but the same account is reported from a single reporter.
        Report::create(['reporter_id' => $reporter->id, 'reported_type' => 'user', 'reported_id' => $target->id, 'reason' => 'spam', 'status' => 'reviewed']);
        Report::create(['reporter_id' => $reporter->id, 'reported_type' => 'user', 'reported_id' => $target->id, 'reason' => 'spam', 'status' => 'pending']);
        Report::create(['reporter_id' => $reporter->id, 'reported_type' => 'user', 'reported_id' => $target->id, 'reason' => 'spam', 'status' => 'pending']);
        $this->report($this->member('+15550000015'), $target);

        $this->assertSame('active', $target->fresh()->status);
    }

    public function test_dismissed_reports_do_not_count_toward_suspension(): void
    {
        $target = $this->member('+15550000007');
        Report::create(['reporter_id' => $this->member('+15550000021')->id, 'reported_type' => 'user', 'reported_id' => $target->id, 'reason' => 'spam', 'status' => 'dismissed']);
        Report::create(['reporter_id' => $this->member('+15550000022')->id, 'reported_type' => 'user', 'reported_id' => $target->id, 'reason' => 'spam', 'status' => 'dismissed']);

        $this->report($this->member('+15550000023'), $target);
        $this->report($this->member('+15550000024'), $target);

        $this->assertSame('active', $target->fresh()->status);
    }

    // ── Login and re-registration ──────────────────────────────

    public function test_a_suspended_account_gets_no_code_and_is_sent_to_appeal(): void
    {
        $target = $this->member('+15550000008');
        $target->update(['status' => 'suspended', 'suspension_source' => 'auto_reports']);

        $this->postJson('/api/v1/auth/otp/request', [
            'intent' => 'login',
            'phone_e164' => '+15550000008',
            'country_iso2' => 'US',
        ])->assertOk()
            ->assertJsonPath('data.account_status', 'suspended')
            ->assertJsonPath('data.requires_appeal', true);
    }

    public function test_a_number_tied_to_an_account_cannot_register_again(): void
    {
        $target = $this->member('+15550000009');
        $target->update(['status' => 'banned']);

        $this->postJson('/api/v1/auth/otp/request', [
            'intent' => 'register',
            'phone_e164' => '+15550000009',
            'country_iso2' => 'US',
        ])->assertStatus(422);
    }

    // ── Appeals ────────────────────────────────────────────────

    public function test_an_approved_appeal_reinstates_the_account_and_clears_its_reports(): void
    {
        $target = $this->member('+15550000030');
        $target->update(['status' => 'suspended', 'suspension_source' => 'auto_reports', 'suspension_reason' => 'Reports']);
        Report::create(['reporter_id' => $this->member('+15550000031')->id, 'reported_type' => 'user', 'reported_id' => $target->id, 'reason' => 'spam', 'status' => 'pending']);

        $this->postJson('/api/v1/auth/account/appeals', [
            'phone_e164' => '+15550000030',
            'email' => $target->email,
            'message' => 'I was reported by mistake. I have not broken any rules.',
        ])->assertStatus(202);

        $appeal = AccountAppeal::where('user_id', $target->id)->firstOrFail();

        $this->actAsSession($this->admin());
        $this->postJson("/api/v1/securegate/account-appeals/{$appeal->id}/decision", ['decision' => 'approve'])
            ->assertOk();

        $target->refresh();
        $this->assertSame('active', $target->status);
        $this->assertNull($target->suspension_source);
        $this->assertSame('approved', $appeal->fresh()->status);
        $this->assertSame(0, Report::where('reported_id', $target->id)->where('status', '!=', 'dismissed')->count());
    }

    public function test_a_rejected_appeal_disables_the_account_for_good(): void
    {
        $target = $this->member('+15550000032');
        $target->update(['status' => 'suspended', 'suspension_source' => 'auto_reports']);

        $this->postJson('/api/v1/auth/account/appeals', [
            'phone_e164' => '+15550000032',
            'email' => $target->email,
            'message' => 'Please review this again, I think it was an error.',
        ])->assertStatus(202);

        $appeal = AccountAppeal::where('user_id', $target->id)->firstOrFail();

        $this->actAsSession($this->admin());
        $this->postJson("/api/v1/securegate/account-appeals/{$appeal->id}/decision", ['decision' => 'reject'])
            ->assertOk();

        $target->refresh();
        $this->assertSame('banned', $target->status);
        $this->assertSame('appeal_rejected', $target->suspension_source);

        // A banned account gets no code and cannot register again with the same number.
        $this->postJson('/api/v1/auth/otp/request', [
            'intent' => 'login',
            'phone_e164' => '+15550000032',
            'country_iso2' => 'US',
        ])->assertStatus(422);
    }

    public function test_an_appeal_without_the_account_email_is_not_recorded(): void
    {
        $target = $this->member('+15550000034');
        $target->update(['status' => 'suspended']);

        $this->postJson('/api/v1/auth/account/appeals', [
            'phone_e164' => '+15550000034',
            'email' => 'stranger@example.com',
            'message' => 'Please review this account, it was suspended in error.',
        ])->assertStatus(202);

        $this->assertSame(0, AccountAppeal::count());
    }

    public function test_only_the_account_team_can_decide_appeals(): void
    {
        $target = $this->member('+15550000033');
        $target->update(['status' => 'suspended']);
        $this->postJson('/api/v1/auth/account/appeals', [
            'phone_e164' => '+15550000033',
            'email' => $target->email,
            'message' => 'Please review my account, it was suspended in error.',
        ]);
        $appeal = AccountAppeal::where('user_id', $target->id)->firstOrFail();

        $this->actAsSession($this->admin('finance_admin'));
        $this->postJson("/api/v1/securegate/account-appeals/{$appeal->id}/decision", ['decision' => 'approve'])
            ->assertStatus(403);
    }
}
