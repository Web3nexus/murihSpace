<?php

namespace App\Services\AiProviders;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class OpenAiAiProvider implements AiProviderContract
{
    public function __construct(
        private readonly string $key,
        private readonly string $model,
        private readonly string $endpoint,
    ) {}

    public function name(): string
    {
        return 'openai';
    }

    public function isConfigured(): bool
    {
        return (bool) $this->key;
    }

    public function model(): string
    {
        return $this->model;
    }

    private function basePayload(array $messages, int $maxTokens, ?array $responseFormat): array
    {
        $payload = [
            'model' => $this->model,
            'max_tokens' => $maxTokens,
            'messages' => $messages,
        ];

        if ($responseFormat !== null) {
            $payload['response_format'] = $responseFormat;
        }

        return $payload;
    }

    private function post(array $payload): array
    {
        $response = Http::withToken($this->key)
            ->acceptJson()
            ->timeout(60)
            ->post($this->endpoint, $payload);

        if ($response->failed()) {
            Log::warning('OpenAI request failed', [
                'status' => $response->status(),
                'error' => $response->json('error.message') ?? $response->body(),
            ]);

            return [];
        }

        return $response->json() ?? [];
    }

    public function chat(string $system, array $messages, int $maxTokens): string
    {
        $payload = $this->basePayload(
            array_merge([['role' => 'system', 'content' => $system]], $messages),
            $maxTokens,
            null,
        );

        $data = $this->post($payload);

        return trim((string) ($data['choices'][0]['message']['content'] ?? ''));
    }

    public function structured(string $system, string $userPrompt, array $schema, int $maxTokens): ?array
    {
        $payload = $this->basePayload([
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $userPrompt."\n\nRespond with valid JSON only, matching the required schema."],
        ], $maxTokens, ['type' => 'json_object']);

        $data = $this->post($payload);

        $text = trim((string) ($data['choices'][0]['message']['content'] ?? ''));

        if ($text === '') {
            return null;
        }

        $decoded = json_decode($text, true);

        return is_array($decoded) ? $decoded : null;
    }
}
