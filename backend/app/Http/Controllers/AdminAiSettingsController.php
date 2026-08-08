<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
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
        $defaults = config('services.anthropic.behavior', []);

        return response()->json([
            'data' => [
                'provider' => $this->manager->selected(),
                'default_provider' => config('services.ai.default_provider', 'anthropic'),
                'max_tokens' => (int) config('services.ai.max_tokens', 1024),
                'providers' => $this->manager->metadata(),
                'guardrails' => [
                    'persona' => AdminSetting::get('ai_guardrail_persona') ?: ($defaults['persona'] ?? 'Mera'),
                    'tone' => AdminSetting::get('ai_guardrail_tone') ?: ($defaults['tone'] ?? 'Warm, friendly and practical. Encouraging without being generic.'),
                    'keep_on_topic' => AdminSetting::get('ai_guardrail_keep_on_topic') !== null
                        ? (bool) AdminSetting::get('ai_guardrail_keep_on_topic')
                        : (bool) ($defaults['keep_on_topic'] ?? true),
                    'off_topic_mode' => AdminSetting::get('ai_guardrail_off_topic_mode') ?: ($defaults['off_topic_mode'] ?? 'redirect'),
                    'focus_topics' => ($stored = AdminSetting::get('ai_guardrail_focus_topics'))
                        ? json_decode((string) $stored, true)
                        : ($defaults['focus_topics'] ?? []),
                ],
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
            // Admin-locked on-topic guardrails applied platform-wide
            'persona' => ['sometimes', 'nullable', 'string', 'max:80'],
            'tone' => ['sometimes', 'nullable', 'string', 'max:200'],
            'keep_on_topic' => ['sometimes', 'boolean'],
            'off_topic_mode' => ['sometimes', 'string', Rule::in(['redirect', 'decline', 'flexible'])],
            'focus_topics' => ['sometimes', 'array', 'max:20'],
            'focus_topics.*' => ['string', 'max:80'],
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

        $this->storeGuardrails($validated);

        return response()->json([
            'message' => 'AI provider configuration updated.',
            'data' => [
                'provider' => $this->manager->selected(),
                'providers' => $this->manager->metadata(),
            ],
        ]);
    }

    private function storeGuardrails(array $data): void
    {
        if (array_key_exists('persona', $data)) {
            AdminSetting::set('ai_guardrail_persona', trim((string) $data['persona']));
        }
        if (array_key_exists('tone', $data)) {
            AdminSetting::set('ai_guardrail_tone', trim((string) $data['tone']));
        }
        if (array_key_exists('keep_on_topic', $data)) {
            AdminSetting::set('ai_guardrail_keep_on_topic', $data['keep_on_topic'] ? '1' : '0');
        }
        if (array_key_exists('off_topic_mode', $data)) {
            AdminSetting::set('ai_guardrail_off_topic_mode', $data['off_topic_mode']);
        }
        if (array_key_exists('focus_topics', $data)) {
            AdminSetting::set('ai_guardrail_focus_topics', json_encode(array_values(array_filter(array_map('trim', $data['focus_topics'])))));
        }
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
