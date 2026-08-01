<?php

namespace App\Services\AiProviders;

interface AiProviderContract
{
    public function name(): string;

    public function isConfigured(): bool;

    public function model(): string;

    /**
     * Send a chat completion and return the text reply (trimmed).
     */
    public function chat(string $system, array $messages, int $maxTokens): string;

    /**
     * Send a prompt that must return structured JSON matching $schema.
     * Returns the decoded array, or null when unavailable/invalid.
     */
    public function structured(string $system, string $userPrompt, array $schema, int $maxTokens): ?array;
}
