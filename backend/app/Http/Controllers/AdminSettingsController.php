<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
use App\Services\CurrencyConverter;
use App\Services\Kyc\KycProviderManager;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSettingsController extends Controller
{
    public function __construct(
        private readonly CurrencyConverter $converter,
        private readonly KycProviderManager $providers,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $supported = $this->converter->getSupportedCurrencies();
        $selected = json_decode((string) AdminSetting::get('kyc_providers', '[]'), true);

        if (! is_array($selected) || $selected === []) {
            $selected = $this->providers->selectedProviderNames();
        }

        return response()->json([
            'data' => [
                'platform_name' => config('app.name'),
                'maintenance_mode' => AdminSetting::get('maintenance_mode', false),
                'registration_open' => (bool) AdminSetting::get('registration_open', !config('app.disable_registration')),
                'default_currency' => AdminSetting::get('default_currency', config('app.currency', 'USD')),
                'supported_currencies' => $supported,
                'default_role' => 'member',
                'kyc_required_for' => ['creator', 'vendor'],
                'kyc_providers' => array_values($selected),
                'kyc_providers_available' => array_map(
                    fn ($name, $provider) => [
                        'name' => $name,
                        'enabled' => $provider->isEnabled(),
                        'label' => match ($name) {
                            'didit' => 'Didit',
                            'sumsub' => 'Sumsub',
                            default => 'Manual review',
                        },
                    ],
                    array_keys($this->providers->all()),
                    array_values($this->providers->all()),
                ),
                'max_upload_size_mb' => 100,
                'web_disabled_roles' => json_decode((string) AdminSetting::get('web_disabled_roles', '[]'), true),
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'maintenance_mode' => ['sometimes', 'boolean'],
            'registration_open' => ['sometimes', 'boolean'],
            'default_currency' => ['sometimes', 'string', 'size:3', Rule::in($this->converter->getSupportedCurrencies())],
            'web_disabled_roles' => ['sometimes', 'array'],
            'web_disabled_roles.*' => ['string', Rule::in(['member', 'creator', 'vendor'])],
            'kyc_providers' => ['sometimes', 'array'],
            'kyc_providers.*' => ['string', Rule::in(['didit', 'sumsub', 'manual'])],
        ]);

        if (isset($validated['maintenance_mode'])) {
            AdminSetting::set('maintenance_mode', $validated['maintenance_mode']);
        }

        if (isset($validated['registration_open'])) {
            AdminSetting::set('registration_open', $validated['registration_open']);
        }

        if (isset($validated['default_currency'])) {
            AdminSetting::set('default_currency', $validated['default_currency']);
        }

        if (isset($validated['web_disabled_roles'])) {
            AdminSetting::set('web_disabled_roles', json_encode(array_values(array_unique($validated['web_disabled_roles']))));
        }

        if (isset($validated['kyc_providers'])) {
            AdminSetting::set('kyc_providers', json_encode(array_values(array_unique($validated['kyc_providers']))));
        }

        return response()->json([
            'message' => 'Settings updated.',
            'data' => [
                'maintenance_mode' => AdminSetting::get('maintenance_mode', false),
                'registration_open' => (bool) AdminSetting::get('registration_open', !config('app.disable_registration')),
                'default_currency' => AdminSetting::get('default_currency', config('app.currency', 'USD')),
                'web_disabled_roles' => json_decode((string) AdminSetting::get('web_disabled_roles', '[]'), true),
                'kyc_providers' => json_decode((string) AdminSetting::get('kyc_providers', '[]'), true),
            ],
        ]);
    }
}
