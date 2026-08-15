<?php

namespace Tests\Feature;

use App\Models\SupportMessage;
use App\Models\SupportThread;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LegacySupportThreadTest extends TestCase
{
    use RefreshDatabase;

    public function test_message_write_is_enabled_by_default(): void
    {
        $user = User::factory()->create();
        $thread = SupportThread::create(['user_id' => $user->id, 'subject' => 'Hello', 'status' => 'open']);

        Sanctum::actingAs($user);

        $this->postJson("/api/v1/support/threads/{$thread->id}/messages", [
            'content' => 'Please help me.',
        ])->assertStatus(201);

        $this->assertSame(1, SupportMessage::where('thread_id', $thread->id)->count());
    }

    public function test_message_write_returns_410_when_disabled(): void
    {
        config(['services.legacy_support_threads.enabled' => false]);

        $user = User::factory()->create();
        $thread = SupportThread::create(['user_id' => $user->id, 'subject' => 'Hello', 'status' => 'open']);

        Sanctum::actingAs($user);

        $this->postJson("/api/v1/support/threads/{$thread->id}/messages", [
            'content' => 'Please help me.',
        ])->assertStatus(410);

        $this->assertSame(0, SupportMessage::count());
    }

    public function test_reads_remain_available_when_disabled(): void
    {
        config(['services.legacy_support_threads.enabled' => false]);

        $user = User::factory()->create();
        $thread = SupportThread::create(['user_id' => $user->id, 'subject' => 'Hello', 'status' => 'open']);

        Sanctum::actingAs($user);

        $this->getJson("/api/v1/support/threads/{$thread->id}/messages")->assertOk();
        $this->getJson('/api/v1/support/threads')->assertOk();
    }
}
