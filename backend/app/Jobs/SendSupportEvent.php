<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class SendSupportEvent implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $backoff = 10;

    public function __construct(
        public readonly string $eventKey,
        public readonly array $payload = [],
        public readonly ?string $actorType = null,
        public readonly ?string $actorReference = null,
        public readonly ?string $customerEmail = null,
        public readonly ?int $occurredAt = null,
        public readonly ?string $eventId = null,
    ) {}

    public function handle(): void
    {
        $baseUrl = (string) config('services.support_events.base_url');
        $token = (string) config('services.support_events.token');

        if (! $baseUrl || ! $token) {
            return; // Event sync not configured — drop silently.
        }

        try {
            $response = Http::baseUrl($baseUrl)
                ->timeout(10)
                ->withHeaders([
                    'X-Internal-Token' => $token,
                    'X-Timestamp' => (string) now()->getTimestamp(),
                    'X-Nonce' => bin2hex(random_bytes(24)),
                ])
                ->post(config('services.support_events.endpoint'), [
                    'event_id' => $this->eventId ?? $this->eventKey.'-'.Str::uuid(),
                    'event_key' => $this->eventKey,
                    'actor_type' => $this->actorType,
                    'actor_reference' => $this->actorReference,
                    'customer_email' => $this->customerEmail,
                    'occurred_at' => $this->occurredAt ? date('c', $this->occurredAt) : null,
                    'payload' => $this->payload,
                ]);
        } catch (ConnectionException) {
            // Upstream unreachable — fail the job so the queue retries.
            $this->fail();

            return;
        }

        if ($response->serverError()) {
            // Transient upstream failure — release for retry. Upstream dedupe on
            // event_id makes re-delivery safe.
            $this->release($this->backoff);
        }
    }
}
