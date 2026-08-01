<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
use App\Services\CurrencyConverter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSettingsController extends Controller
{
    public function __construct(
        private readonly CurrencyConverter $converter,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $supported = $this->converter->getSupportedCurrencies();

        return response()->json([
            'data' => [
                'platform_name' => config('app.name'),
                'maintenance_mode' => AdminSetting::get('maintenance_mode', false),
                'registration_open' => (bool) AdminSetting::get('registration_open', !config('app.disable_registration')),
                'default_currency' => AdminSetting::get('default_currency', config('app.currency', 'USD')),
                'supported_currencies' => $supported,
                'default_role' => 'member',
                'kyc_required_for' => ['creator', 'vendor'],
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

        return response()->json([
            'message' => 'Settings updated.',
            'data' => [
                'maintenance_mode' => AdminSetting::get('maintenance_mode', false),
                'registration_open' => (bool) AdminSetting::get('registration_open', !config('app.disable_registration')),
                'default_currency' => AdminSetting::get('default_currency', config('app.currency', 'USD')),
                'web_disabled_roles' => json_decode((string) AdminSetting::get('web_disabled_roles', '[]'), true),
            ],
        ]);
    }
}
