<?php

namespace App\Services;

use App\Models\AdminSetting;
use App\Services\AiProviders\AiProviderContract;
use App\Services\AiProviders\AnthropicAiProvider;
use App\Services\AiProviders\GeminiAiProvider;
use App\Services\AiProviders\OpenAiAiProvider;
use Exception;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Log;

class AiProviderManager
{
    /**
     * @return string[]
     */
    public function providers(): array
    {
        return config('services.ai.providers', ['anthropic', 'openai', 'gemini']);
    }

    public function selected(): string
    {
        $selected = (string) AdminSetting::get('ai_provider', config('services.ai.default_provider', 'anthropic'));

        return in_array($selected, $this->providers(), true) ? $selected : 'anthropic';
    }

    public function setSelected(string $provider): void
    {
        if (! in_array($provider, $this->providers(), true)) {
            return;
        }

        AdminSetting::set('ai_provider', $provider);
    }

    public function defaultProvider(): ?AiProviderContract
    {
        return $this->resolve($this->selected());
    }

    public function resolve(string $provider): ?AiProviderContract
    {
        if (! in_array($provider, $this->providers(), true)) {
            return null;
        }

        $key = $this->stored($provider, 'key') ?: (string) config("services.{$provider}.key");
        $model = $this->stored($provider, 'model') ?: (string) config("services.{$provider}.model");

        return match ($provider) {
            'openai' => new OpenAiAiProvider($key, $model, (string) config('services.openai.endpoint')),
            'gemini' => new GeminiAiProvider($key, $model, (string) config('services.gemini.endpoint')),
            default => new AnthropicAiProvider($key, $model),
        };
    }

    /**
     * Metadata for the admin UI. Never exposes keys.
     */
    public function metadata(): array
    {
        $meta = [];

        foreach ($this->providers() as $provider) {
            $instance = $this->resolve($provider);
            $meta[$provider] = [
                'configured' => $instance?->isConfigured() ?? false,
                'model' => $instance?->model(),
                'key_from_env' => (bool) config("services.{$provider}.key"),
            ];
        }

        return $meta;
    }

    public function configure(string $provider, ?string $key, ?string $model): void
    {
        if (! in_array($provider, $this->providers(), true)) {
            return;
        }

        if ($key !== null && trim($key) !== '') {
            AdminSetting::set("ai_provider_{$provider}_key", Crypt::encryptString(trim($key)));
        }

        if ($model !== null) {
            AdminSetting::set("ai_provider_{$provider}_model", trim($model));
        }
    }

    private function stored(string $provider, string $field): ?string
    {
        $key = "ai_provider_{$provider}_{$field}";
        $raw = AdminSetting::get($key);

        if ($raw === null || $raw === '') {
            return null;
        }

        if ($field === 'key') {
            try {
                return Crypt::decryptString((string) $raw);
            } catch (Exception $e) {
                Log::warning("Failed to decrypt AI provider key for {$provider}", ['error' => $e->getMessage()]);

                return null;
            }
        }

        return (string) $raw;
    }
}
