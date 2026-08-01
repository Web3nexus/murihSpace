<?php

namespace App\Services\AiProviders;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GeminiAiProvider implements AiProviderContract
{
    public function __construct(
        private readonly string $key,
        private readonly string $model,
        private readonly string $endpoint,
    ) {}

    public function name(): string
    {
        return 'gemini';
    }

    public function isConfigured(): bool
    {
        return (bool) $this->key;
    }

    public function model(): string
    {
        return $this->model;
    }

    private function generateUrl(string $action): string
    {
        return rtrim($this->endpoint, '/').'/'.rawurlencode($this->model).':'.$action.'?key='.rawurlencode($this->key);
    }

    private function mapMessages(array $messages): array
    {
        return array_map(
            fn ($m) => [
                'role' => $m['role'] === 'assistant' ? 'model' : 'user',
                'parts' => [['text' => (string) $m['content']]],
            ],
            $messages,
        );
    }

    private function post(string $action, array $payload): array
    {
        $response = Http::acceptJson()
            ->timeout(60)
            ->post($this->generateUrl($action), $payload);

        if ($response->failed()) {
            Log::warning('Gemini request failed', [
                'status' => $response->status(),
                'error' => $response->json('error.message') ?? $response->body(),
            ]);

            return [];
        }

        return $response->json() ?? [];
    }

    private function textFromData(array $data): string
    {
        $text = '';

        foreach ($data['candidates'][0]['content']['parts'] ?? [] as $part) {
            $text .= (string) ($part['text'] ?? '');
        }

        return trim($text);
    }

    public function chat(string $system, array $messages, int $maxTokens): string
    {
        $data = $this->post('generateContent', [
            'systemInstruction' => ['parts' => [['text' => $system]]],
            'contents' => $this->mapMessages($messages),
            'generationConfig' => ['maxOutputTokens' => $maxTokens],
        ]);

        return $this->textFromData($data);
    }

    public function structured(string $system, string $userPrompt, array $schema, int $maxTokens): ?array
    {
        $data = $this->post('generateContent', [
            'systemInstruction' => ['parts' => [['text' => $system]]],
            'contents' => [
                ['role' => 'user', 'parts' => [['text' => $userPrompt."\n\nRespond with valid JSON only, matching the required schema."]]],
            ],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'maxOutputTokens' => $maxTokens,
            ],
        ]);

        $text = $this->textFromData($data);

        if ($text === '') {
            return null;
        }

        $decoded = json_decode($text, true);

        return is_array($decoded) ? $decoded : null;
    }
}
