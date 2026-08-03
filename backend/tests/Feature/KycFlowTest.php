<?php

namespace Tests\Feature;

use App\Enums\KycStatus;
use App\Jobs\ProcessKycWebhook;
use App\Models\KycVerification;
use App\Models\KycWebhookEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class KycFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('kyc.providers', ['didit']);
        Config::set('kyc.required_for_sellers', true);
        Config::set('kyc.didit.enabled', true);
        Config::set('kyc.didit.api_key', 'test-api-key');
        Config::set('kyc.didit.workflow_id', 'workflow-1');
        Config::set('kyc.didit.webhook_secret', 'webhook-secret');
        Config::set('sumsub.enabled', false);
    }

    public function test_status_returns_defaults_for_unsubmitted_user(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/kyc/status')
            ->assertStatus(200)
            ->assertJson([
                'data' => [
                    'kyc_status' => 'unsubmitted',
                    'kyc_provider' => 'didit',
                    'provider_enabled' => true,
                ],
            ]);
    }

    public function test_start_session_creates_verification_and_marks_user_pending(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending']);

        Http::fake([
            'verification.didit.me/*' => Http::response([
                'id' => 'session-abc123',
                'url' => 'https://verify.didit.me/session/abc123',
            ], 200),
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/kyc/start');

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'session_url' => 'https://verify.didit.me/session/abc123',
                    'session_id' => 'session-abc123',
                    'kyc_status' => 'pending',
                    'provider' => 'didit',
                ],
            ]);

        $this->assertDatabaseHas('kyc_verifications', [
            'user_id' => $user->id,
            'provider' => 'didit',
            'provider_session_id' => 'session-abc123',
            'status' => 'pending',
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'kyc_status' => 'pending',
            'kyc_provider' => 'didit',
        ]);

        Http::assertSent(fn ($request) => str_contains($request->url(), '/v3/session/'));
    }

    public function test_webhook_accepts_valid_signature_and_queues_processing(): void
    {
        Queue::fake();

        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending']);
        KycVerification::create([
            'user_id' => $user->id,
            'provider' => 'didit',
            'status' => 'pending',
            'provider_session_id' => 'session-abc123',
            'started_at' => now(),
        ]);

        $payload = [
            'event_id' => 'evt-1',
            'session_id' => 'session-abc123',
            'webhook_type' => 'session.decision',
            'status' => 'approved',
            'vendor_data' => 'murihspace_user_' . $user->uuid,
        ];

        // Sign with the V2 canonical form (sorted compact JSON, unicode preserved).
        $secret = 'webhook-secret';
        $canonical = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
        $signature = hash_hmac('sha256', $canonical, $secret);

        $this->postJson('/api/v1/webhooks/didit', $payload, [
            'X-Signature-V2' => $signature,
        ])->assertStatus(200);

        $this->assertDatabaseHas('kyc_webhook_events', [
            'provider' => 'didit',
            'provider_event_id' => 'evt-1',
            'provider_session_id' => 'session-abc123',
            'processing_status' => 'pending',
        ]);

        Queue::assertPushed(ProcessKycWebhook::class);
    }

    public function test_webhook_rejects_invalid_signature(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending']);
        KycVerification::create([
            'user_id' => $user->id,
            'provider' => 'didit',
            'status' => 'pending',
            'provider_session_id' => 'session-abc123',
            'started_at' => now(),
        ]);

        $this->postJson('/api/v1/webhooks/didit', [
            'event_id' => 'evt-bad',
            'session_id' => 'session-abc123',
            'webhook_type' => 'session.decision',
            'status' => 'approved',
            'vendor_data' => 'murihspace_user_' . $user->uuid,
        ], [
            'X-Signature-V2' => 'invalid-signature',
        ])->assertStatus(401);

        $this->assertDatabaseMissing('kyc_webhook_events', ['provider_event_id' => 'evt-bad']);
    }

    public function test_webhook_processing_approves_user(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending']);
        $verification = KycVerification::create([
            'user_id' => $user->id,
            'provider' => 'didit',
            'status' => 'pending',
            'provider_session_id' => 'session-abc123',
            'started_at' => now(),
        ]);

        $event = KycWebhookEvent::create([
            'provider' => 'didit',
            'provider_event_id' => 'evt-1',
            'provider_session_id' => 'session-abc123',
            'type' => 'session.decision',
            'status' => 'approved',
            'processing_status' => 'pending',
            'raw_payload' => [
                'event_id' => 'evt-1',
                'session_id' => 'session-abc123',
                'webhook_type' => 'session.decision',
                'status' => 'approved',
                'vendor_data' => 'murihspace_user_' . $user->uuid,
            ],
            'received_at' => now(),
        ]);

        (new ProcessKycWebhook($event))->handle(app(\App\Services\Kyc\KycService::class));

        $this->assertDatabaseHas('kyc_verifications', [
            'id' => $verification->id,
            'status' => 'verified',
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'kyc_status' => 'verified',
        ]);
    }

    public function test_webhook_processing_rejects_user_with_reason(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending']);
        $verification = KycVerification::create([
            'user_id' => $user->id,
            'provider' => 'didit',
            'status' => 'pending',
            'provider_session_id' => 'session-abc123',
            'started_at' => now(),
        ]);

        $event = KycWebhookEvent::create([
            'provider' => 'didit',
            'provider_event_id' => 'evt-2',
            'provider_session_id' => 'session-abc123',
            'type' => 'session.decision',
            'status' => 'rejected',
            'processing_status' => 'pending',
            'raw_payload' => [
                'event_id' => 'evt-2',
                'session_id' => 'session-abc123',
                'webhook_type' => 'session.decision',
                'status' => 'rejected',
                'rejection_reason' => 'Document did not match',
                'vendor_data' => 'murihspace_user_' . $user->uuid,
            ],
            'received_at' => now(),
        ]);

        (new ProcessKycWebhook($event))->handle(app(\App\Services\Kyc\KycService::class));

        $this->assertDatabaseHas('kyc_verifications', [
            'id' => $verification->id,
            'status' => 'rejected',
            'rejection_reason' => 'Document did not match',
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'kyc_status' => 'rejected',
            'kyc_rejection_reason' => 'Document did not match',
        ]);
    }

    public function test_duplicate_webhook_is_idempotent(): void
    {
        Queue::fake();

        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending']);
        KycVerification::create([
            'user_id' => $user->id,
            'provider' => 'didit',
            'status' => 'pending',
            'provider_session_id' => 'session-abc123',
            'started_at' => now(),
        ]);

        $payload = [
            'event_id' => 'evt-dup',
            'session_id' => 'session-abc123',
            'webhook_type' => 'session.decision',
            'status' => 'approved',
            'vendor_data' => 'murihspace_user_' . $user->uuid,
        ];
        $secret = 'webhook-secret';
        $canonical = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION);
        $signature = hash_hmac('sha256', $canonical, $secret);

        $headers = ['X-Signature-V2' => $signature];

        $this->postJson('/api/v1/webhooks/didit', $payload, $headers)->assertStatus(200);
        $this->postJson('/api/v1/webhooks/didit', $payload, $headers)->assertStatus(200);

        $this->assertSame(
            1,
            KycWebhookEvent::where('provider_event_id', 'evt-dup')->count(),
            'Duplicate webhook deliveries must not create duplicate event rows.',
        );

        Queue::assertPushed(ProcessKycWebhook::class, 1);
    }

    public function test_seller_route_gated_by_kyc_middleware(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending']);

        Sanctum::actingAs($user);

        $this->postJson('/api/v1/store/products', [
            'title' => 'Test Product',
            'price' => 100,
            'is_free' => false,
            'category' => 'ebook',
        ])->assertStatus(403);
    }

    public function test_seller_route_allowed_when_kyc_verified(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'verified']);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/store/products', [
            'title' => 'Test Product',
            'price' => 100,
            'is_free' => false,
            'category' => 'ebook',
        ]);

        $this->assertNotSame(403, $response->getStatusCode());
    }

    public function test_admin_approve_creates_verification_record(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'kyc_status' => 'verified']);
        $creator = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending']);

        Sanctum::actingAs($admin);

        $this->postJson("/api/v1/securegate/kyc/{$creator->id}/approve")
            ->assertStatus(200)
            ->assertJson([
                'data' => [
                    'id' => $creator->id,
                    'kyc_status' => 'verified',
                ],
            ]);

        $this->assertDatabaseHas('kyc_verifications', [
            'user_id' => $creator->id,
            'status' => 'verified',
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $creator->id,
            'kyc_status' => 'verified',
        ]);
    }

    public function test_user_history_returns_attempts(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'verified']);

        KycVerification::create([
            'user_id' => $user->id,
            'provider' => 'didit',
            'status' => 'verified',
            'provider_session_id' => 'session-1',
            'started_at' => now(),
            'completed_at' => now(),
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/kyc/history')
            ->assertStatus(200)
            ->assertJsonCount(1, 'data.data');
    }

    public function test_status_lists_enabled_providers(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        Sanctum::actingAs($user);

        $this->getJson('/api/v1/kyc/status')
            ->assertStatus(200)
            ->assertJson([
                'data' => [
                    'kyc_provider' => 'didit',
                    'provider_enabled' => true,
                    'providers' => ['didit' => true],
                ],
            ]);
    }

    public function test_admin_can_activate_both_providers_via_settings(): void
    {
        Config::set('sumsub.enabled', true);
        Config::set('sumsub.app_token', 'app-token');
        Config::set('sumsub.secret_key', 'secret-key');

        $admin = User::factory()->create(['role' => 'admin', 'kyc_status' => 'verified']);

        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/securegate/settings', [
            'kyc_providers' => ['didit', 'sumsub'],
        ])->assertStatus(200);

        $this->assertDatabaseHas('admin_settings', [
            'key' => 'kyc_providers',
            'value' => '["didit","sumsub"]',
        ]);
    }

    public function test_start_respects_explicit_provider_choice(): void
    {
        Config::set('sumsub.enabled', true);
        Config::set('sumsub.app_token', 'app-token');
        Config::set('sumsub.secret_key', 'secret-key');
        Config::set('kyc.providers', ['didit', 'sumsub']);

        Http::fake([
            'api.sumsub.com/*/accessTokens*' => Http::response(['token' => 'sumsub-token'], 200),
            'api.sumsub.com/*/applicants*' => Http::response([
                'id' => 'applicant-1',
                'reviewStatus' => 'init',
            ], 200),
            'verification.didit.me/*' => Http::response([
                'id' => 'didit-session',
                'url' => 'https://verify.didit.me/didit-session',
            ], 200),
        ]);

        $user = User::factory()->create(['role' => 'creator']);

        Sanctum::actingAs($user);

        $this->postJson('/api/v1/kyc/start', ['provider' => 'sumsub'])
            ->assertStatus(200)
            ->assertJson([
                'data' => [
                    'provider' => 'sumsub',
                    'session_id' => 'applicant-1',
                ],
            ]);

        $this->assertDatabaseHas('kyc_verifications', [
            'user_id' => $user->id,
            'provider' => 'sumsub',
            'provider_session_id' => 'applicant-1',
        ]);
    }

    public function test_sumsub_webhook_verifies_signature_and_queues(): void
    {
        Config::set('sumsub.enabled', true);
        Config::set('sumsub.webhook_secret', 'sumsub-secret');

        Queue::fake();

        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending', 'sumsub_applicant_id' => 'applicant-1']);

        $payload = [
            'id' => 'evt-sumsub-1',
            'applicantId' => 'applicant-1',
            'type' => 'applicantReviewed',
            'reviewResult' => ['reviewAnswer' => 'GREEN'],
        ];

        $digest = hash_hmac('sha256', json_encode($payload), 'sumsub-secret');

        $this->postJson('/api/v1/webhooks/sumsub', $payload, [
            'X-Payload-Digest' => $digest,
            'X-Payload-Digest-Alg' => 'HMAC_SHA256_HEX',
        ])->assertStatus(200);

        $this->assertDatabaseHas('kyc_webhook_events', [
            'provider' => 'sumsub',
            'provider_event_id' => 'evt-sumsub-1',
            'provider_session_id' => 'applicant-1',
            'processing_status' => 'pending',
        ]);

        Queue::assertPushed(ProcessKycWebhook::class);
    }

    public function test_sumsub_final_reject_type_does_not_approve_user(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'pending', 'sumsub_applicant_id' => 'applicant-final']);
        $verification = KycVerification::create([
            'user_id' => $user->id,
            'provider' => 'sumsub',
            'status' => 'pending',
            'provider_session_id' => 'applicant-final',
            'started_at' => now(),
        ]);

        // FINAL is a reviewRejectType (permanent rejection), never an approval.
        $event = KycWebhookEvent::create([
            'provider' => 'sumsub',
            'provider_event_id' => 'evt-final',
            'provider_session_id' => 'applicant-final',
            'type' => 'applicantReviewed',
            'status' => 'rejected',
            'processing_status' => 'pending',
            'raw_payload' => [
                'id' => 'evt-final',
                'applicantId' => 'applicant-final',
                'type' => 'applicantReviewed',
                'reviewResult' => ['reviewAnswer' => 'RED', 'reviewRejectType' => 'FINAL'],
            ],
            'received_at' => now(),
        ]);

        (new ProcessKycWebhook($event))->handle(app(\App\Services\Kyc\KycService::class));

        $this->assertDatabaseHas('kyc_verifications', [
            'id' => $verification->id,
            'status' => 'rejected',
        ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'kyc_status' => 'rejected',
        ]);
    }

    public function test_start_rejects_disabled_provider_choice(): void
    {
        Config::set('kyc.providers', ['didit']);

        $user = User::factory()->create(['role' => 'creator']);

        Sanctum::actingAs($user);

        $this->postJson('/api/v1/kyc/start', ['provider' => 'sumsub'])
            ->assertStatus(422);
    }
}
