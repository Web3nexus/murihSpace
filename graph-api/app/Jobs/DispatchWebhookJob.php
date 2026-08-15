<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class DispatchWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 10;

    public function __construct(
        public readonly string $url,
        public readonly string $secret,
        public readonly array  $eventEnvelope
    ) {}

    public function handle(): void
    {
        $timestamp = time();
        $payload   = json_encode($this->eventEnvelope);

        // Compute HMAC signature
        $signedData = "{$timestamp}.{$payload}";
        $signature  = hash_hmac('sha256', $signedData, $this->secret);

        $client = new Client(['timeout' => 8.0, 'http_errors' => false]);

        try {
            $response = $client->post($this->url, [
                'headers' => [
                    'Content-Type'           => 'application/json',
                    'User-Agent'             => 'MurihSpace-Webhook/1.0',
                    'X-MurihSpace-Signature' => "t={$timestamp},v1={$signature}",
                    'X-MurihSpace-Event'     => $this->eventEnvelope['event_type'] ?? 'webhook',
                ],
                'body' => $payload,
            ]);

            if ($response->getStatusCode() >= 400) {
                Log::warning("Webhook delivery failed to {$this->url} with status {$response->getStatusCode()}");
            }
        } catch (\Throwable $e) {
            Log::error("Webhook error dispatching to {$this->url}: {$e->getMessage()}");
            throw $e;
        }
    }
}
