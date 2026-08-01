<?php

namespace App\Http\Controllers;

use App\Services\AiProviderManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminAiSettingsController extends Controller
{
    public function __construct(
        private readonly AiProviderManager $manager,
    ) {}

    public function show(): JsonResponse
    {
        return response()->json([
            'data' => [
                'provider' => $this->manager->selected(),
                'default_provider' => config('services.ai.default_provider', 'anthropic'),
                'max_tokens' => (int) config('services.ai.max_tokens', 1024),
                'providers' => $this->manager->metadata(),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => ['sometimes', 'string', Rule::in($this->manager->providers())],
            'anthropic_key' => ['sometimes', 'nullable', 'string'],
            'anthropic_model' => ['sometimes', 'nullable', 'string', 'max:80'],
            'openai_key' => ['sometimes', 'nullable', 'string'],
            'openai_model' => ['sometimes', 'nullable', 'string', 'max:80'],
            'gemini_key' => ['sometimes', 'nullable', 'string'],
            'gemini_model' => ['sometimes', 'nullable', 'string', 'max:80'],
        ]);

        if (isset($validated['provider'])) {
            $this->manager->setSelected($validated['provider']);
        }

        foreach ($this->manager->providers() as $provider) {
            $this->manager->configure(
                $provider,
                $validated[$provider.'_key'] ?? null,
                $validated[$provider.'_model'] ?? null,
            );
        }

        return response()->json([
            'message' => 'AI provider configuration updated.',
            'data' => [
                'provider' => $this->manager->selected(),
                'providers' => $this->manager->metadata(),
            ],
        ]);
    }

    public function test(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => ['required', 'string', Rule::in($this->manager->providers())],
        ]);

        $provider = $this->manager->resolve($validated['provider']);

        if (! $provider || ! $provider->isConfigured()) {
            return response()->json([
                'success' => false,
                'message' => 'This provider is not configured yet. Add an API key first.',
            ], 422);
        }

        $started = microtime(true);

        try {
            $text = $provider->chat(
                system: 'You are a connectivity tester. Reply with exactly: OK',
                messages: [['role' => 'user', 'content' => 'ping']],
                maxTokens: 10,
            );

            $latency = (int) ((microtime(true) - $started) * 1000);

            return response()->json([
                'data' => [
                    'ok' => str_contains(strtoupper($text), 'OK'),
                    'latency_ms' => $latency,
                    'response' => $text,
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'data' => [
                    'ok' => false,
                    'error' => $e->getMessage(),
                ],
            ]);
        }
    }
}
