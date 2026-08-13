<?php

namespace Tests\Feature;

use App\Jobs\SendSupportEvent;
use App\Services\SupportEventPublisher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class SupportEventSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        config([
            'services.support_events.base_url' => 'http://support.test',
            'services.support_events.token' => 'support-secret',
            'services.support_events.endpoint' => '/api/internal/events',
            'services.support_events.enabled' => true,
            'queue.default' => 'sync',
        ]);
    }

    public function test_publisher_dispatches_queued_job(): void
    {
        Queue::fake();

        SupportEventPublisher::push('user.created', ['role' => 'creator']);

        Queue::assertPushed(SendSupportEvent::class, fn (SendSupportEvent $job) => $job->eventKey === 'user.created');
    }

    public function test_publisher_respects_disabled_flag(): void
    {
        Queue::fake();
        config(['services.support_events.enabled' => false]);

        SupportEventPublisher::push('user.created');

        Queue::assertNotPushed(SendSupportEvent::class);
    }

    public function test_job_sends_signed_webhook(): void
    {
        Http::fake([
            'support.test/api/internal/events' => Http::response(['success' => true, 'data' => []], 201),
        ]);

        (new SendSupportEvent(
            eventKey: 'kyc.rejected',
            payload: ['reason' => 'Document illegible'],
            actorType: 'kyc',
            actorReference: '77',
            customerEmail: 'mom@example.com',
            eventId: 'kyc-evt-1',
        ))->handle();

        Http::assertSent(function (Request $request) {
            $body = $request->data();
            $nonce = (string) ($request->header('X-Nonce')[0] ?? '');

            return $request->url() === 'http://support.test/api/internal/events'
                && hash_equals('support-secret', (string) ($request->header('X-Internal-Token')[0] ?? ''))
                && strlen($nonce) >= 16
                && ($body['event_id'] ?? null) === 'kyc-evt-1'
                && ($body['event_key'] ?? null) === 'kyc.rejected'
                && ($body['customer_email'] ?? null) === 'mom@example.com'
                && ($body['payload']['reason'] ?? null) === 'Document illegible';
        });
    }

    public function test_job_ignores_when_not_configured(): void
    {
        config(['services.support_events.token' => '']);

        (new SendSupportEvent('user.created'))->handle();

        Http::assertNothingSent();
    }
}
