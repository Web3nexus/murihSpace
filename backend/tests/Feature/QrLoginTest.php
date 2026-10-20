<?php

namespace Tests\Feature;

use App\Models\QrLoginTransaction;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

class QrLoginTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware(ThrottleRequests::class);
    }

    /**
     * @return array<string, mixed>
     */
    private function body($response): array
    {
        $json = $response->json();

        return is_array($json) ? ($json['data'] ?? $json['errors'] ?? $json) : [];
    }

    public function test_start_returns_pairing_tokens_and_qr_payload(): void
    {
        $res = $this->postJson('/api/v1/auth/qr/start');

        $res->assertStatus(200)
            ->assertJsonStructure([
                'data' => ['qr_token', 'poll_token', 'expires_at', 'qr_deep_link', 'qr_url'],
            ]);

        $data = $this->body($res);
        $this->assertNotEmpty($data['qr_token']);
        $this->assertNotEmpty($data['poll_token']);
        $this->assertArrayNotHasKey('confirmation_code', $data);
        $this->assertStringContainsString('murihspace://qr-login?token=', $data['qr_deep_link']);
        $this->assertStringContainsString('/qr-login?token=', $data['qr_url']);

        $this->assertDatabaseHas('qr_login_transactions', [
            'qr_token' => $data['qr_token'],
            'status' => 'pending',
        ]);
        $this->assertDatabaseHas('qr_login_transactions', [
            'qr_token' => $data['qr_token'],
            'confirmation_code_hash' => null,
        ]);
    }

    public function test_poll_on_fresh_transaction_is_pending(): void
    {
        $start = $this->body($this->postJson('/api/v1/auth/qr/start'));

        $res = $this->postJson('/api/v1/auth/qr/poll', ['poll_token' => $start['poll_token']]);

        $res->assertStatus(200);
        $this->assertSame('pending', $this->body($res)['status']);
    }

    public function test_poll_with_unknown_token_returns_gone(): void
    {
        $res = $this->postJson('/api/v1/auth/qr/poll', ['poll_token' => 'does-not-exist']);

        $res->assertStatus(410);
        $this->assertSame('not_found', $this->body($res)['status']);
    }

    public function test_full_flow_scan_approve_then_poll_returns_session_token(): void
    {
        $user = User::factory()->create();

        $start = $this->body($this->postJson('/api/v1/auth/qr/start'));
        $qrToken = $start['qr_token'];
        $pollToken = $start['poll_token'];

        // Mobile scans while authenticated.
        $scan = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/qr/scan', ['qr_token' => $qrToken]);
        $scan->assertStatus(200);
        $scanBody = $this->body($scan);
        $this->assertSame('scanned', $scanBody['status']);
        $txId = $scanBody['transaction_id'];

        // Desktop now observes the scanned state.
        $polled = $this->body($this->postJson('/api/v1/auth/qr/poll', ['poll_token' => $pollToken]));
        $this->assertSame('scanned', $polled['status']);

        // Mobile approves the sign-in it was shown (device details, no code).
        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/auth/qr/{$txId}/approve")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        // Desktop polls and receives the session token.
        $approved = $this->body($this->postJson('/api/v1/auth/qr/poll', ['poll_token' => $pollToken]));
        $this->assertSame('approved', $approved['status']);
        $this->assertNotEmpty($approved['token']);
        $this->assertStringContainsString('|', $approved['token']);
        $this->assertSame($user->id, $approved['user']['id']);

        // The token is single-use: collecting it flips the row to `consumed`.
        $this->assertDatabaseHas('qr_login_transactions', [
            'id' => $txId,
            'status' => 'consumed',
            'user_id' => $user->id,
            'authorized_token' => null,
        ]);

        // A second poll cannot re-fetch the token.
        $again = $this->postJson('/api/v1/auth/qr/poll', ['poll_token' => $pollToken]);
        $again->assertStatus(410);
        $this->assertSame('consumed', $this->body($again)['status']);
    }

    public function test_approve_by_non_owner_is_forbidden(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();

        $start = $this->body($this->postJson('/api/v1/auth/qr/start'));
        $txId = $this->body(
            $this->actingAs($owner, 'sanctum')->postJson('/api/v1/auth/qr/scan', ['qr_token' => $start['qr_token']])
        )['transaction_id'];

        $this->actingAs($other, 'sanctum')
            ->postJson("/api/v1/auth/qr/{$txId}/approve")
            ->assertStatus(403);
    }

    public function test_deny_then_poll_reports_denied(): void
    {
        $user = User::factory()->create();

        $start = $this->body($this->postJson('/api/v1/auth/qr/start'));
        $txId = $this->body(
            $this->actingAs($user, 'sanctum')->postJson('/api/v1/auth/qr/scan', ['qr_token' => $start['qr_token']])
        )['transaction_id'];

        $this->actingAs($user, 'sanctum')
            ->postJson("/api/v1/auth/qr/{$txId}/deny")
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'denied');

        $res = $this->postJson('/api/v1/auth/qr/poll', ['poll_token' => $start['poll_token']]);
        $res->assertStatus(403);
        $this->assertSame('denied', $this->body($res)['status']);
    }

    public function test_scan_with_invalid_qr_token_is_not_found(): void
    {
        $user = User::factory()->create();

        $res = $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/auth/qr/scan', ['qr_token' => 'nope']);

        $res->assertStatus(404);
        $this->assertSame('invalid', $this->body($res)['status']);
    }

    public function test_expired_transaction_reports_expired(): void
    {
        $start = $this->body($this->postJson('/api/v1/auth/qr/start'));

        QrLoginTransaction::where('qr_token', $start['qr_token'])
            ->update(['expires_at' => now()->subMinute()]);

        $res = $this->postJson('/api/v1/auth/qr/poll', ['poll_token' => $start['poll_token']]);

        $res->assertStatus(410);
        $this->assertSame('expired', $this->body($res)['status']);
    }

    public function test_scan_requires_authentication(): void
    {
        $start = $this->body($this->postJson('/api/v1/auth/qr/start'));

        $this->postJson('/api/v1/auth/qr/scan', ['qr_token' => $start['qr_token']])
            ->assertStatus(401);
    }
}
