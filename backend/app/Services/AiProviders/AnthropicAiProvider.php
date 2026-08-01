<?php

namespace App\Services\AiProviders;

use Anthropic\Client;
use Illuminate\Support\Facades\Log;

class AnthropicAiProvider implements AiProviderContract
{
    private ?Client $client = null;

    public function __construct(
        private readonly string $key,
        private readonly string $model,
    ) {}

    public function name(): string
    {
        return 'anthropic';
    }

    public function isConfigured(): bool
    {
        return (bool) $this->key;
    }

    public function model(): string
    {
        return $this->model;
    }

    private function client(): ?Client
    {
        if ($this->client !== null) {
            return $this->client;
        }

        if (! $this->key) {
            return null;
        }

        return $this->client = new Client(apiKey: $this->key);
    }

    public function chat(string $system, array $messages, int $maxTokens): string
    {
        $client = $this->client();

        if (! $client) {
            return '';
        }

        $response = $client->messages->create(
            model: $this->model,
            maxTokens: $maxTokens,
            system: [
                [
                    'type' => 'text',
                    'text' => $system,
                    'cacheControl' => ['type' => 'ephemeral'],
                ],
            ],
            messages: $messages,
        );

        return $this->textFromResponse($response);
    }

    public function structured(string $system, string $userPrompt, array $schema, int $maxTokens): ?array
    {
        $client = $this->client();

        if (! $client) {
            return null;
        }

        $response = $client->messages->create(
            model: $this->model,
            maxTokens: $maxTokens,
            system: [
                [
                    'type' => 'text',
                    'text' => $system,
                    'cacheControl' => ['type' => 'ephemeral'],
                ],
            ],
            messages: [
                ['role' => 'user', 'content' => $userPrompt],
            ],
            outputConfig: [
                'format' => [
                    'type' => 'json_schema',
                    'schema' => $schema,
                ],
            ],
        );

        $text = $this->textFromResponse($response);

        if ($text === '') {
            return null;
        }

        $decoded = json_decode($text, true);

        return is_array($decoded) ? $decoded : null;
    }

    private function textFromResponse(mixed $response): string
    {
        $text = '';

        foreach ($response->content as $block) {
            if ($block->type === 'text') {
                $text .= $block->text;
            }
        }

        return trim($text);
    }
}
