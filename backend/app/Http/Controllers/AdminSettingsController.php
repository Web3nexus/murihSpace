<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
use App\Services\CurrencyConverter;
use App\Services\Kyc\KycCredentials;
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

    private const KYC_CREDENTIAL_KEYS = [
        'didit' => ['api_key', 'client_id', 'client_secret', 'workflow_id', 'webhook_secret'],
        'sumsub' => ['app_token', 'secret_key', 'webhook_secret'],
    ];

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
                'kyc_credentials' => $this->getCredentialsStatus(),
                'kyc_providers_available' => $this->getAvailableProviders(),
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
            'kyc_credentials' => ['sometimes', 'array'],
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

        if (isset($validated['kyc_credentials'])) {
            $this->persistCredentials($validated['kyc_credentials']);
        }

        return response()->json([
            'message' => 'Settings updated.',
            'data' => [
                'maintenance_mode' => AdminSetting::get('maintenance_mode', false),
                'registration_open' => (bool) AdminSetting::get('registration_open', !config('app.disable_registration')),
                'default_currency' => AdminSetting::get('default_currency', config('app.currency', 'USD')),
                'web_disabled_roles' => json_decode((string) AdminSetting::get('web_disabled_roles', '[]'), true),
                'kyc_providers' => json_decode((string) AdminSetting::get('kyc_providers', '[]'), true),
                'kyc_credentials' => $this->getCredentialsStatus(),
                'kyc_providers_available' => $this->getAvailableProviders(),
            ],
        ]);
    }

    private function getCredentialsStatus(): array
    {
        $credentials = [];

        foreach (self::KYC_CREDENTIAL_KEYS as $provider => $keys) {
            $credentials[$provider] = [];

            foreach ($keys as $key) {
                $configVal = match ($provider) {
                    'didit' => config("kyc.didit.{$key}", ''),
                    'sumsub' => config("sumsub.{$key}", ''),
                    default => '',
                };

                $credentials[$provider][$key] = KycCredentials::isSet($provider, $key, $configVal);
            }
        }

        return $credentials;
    }

    private function getAvailableProviders(): array
    {
        return array_map(
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
        );
    }

    /**
     * Persist KYC credential overrides from the admin UI.
     *
     * Secret values are encrypted at rest. Sending an empty string clears the
     * override (falling back to env config); omitting a key leaves it unchanged.
     *
     * @param  array<string, array<string, string>>  $credentials
     */
    private function persistCredentials(array $credentials): void
    {
        foreach (self::KYC_CREDENTIAL_KEYS as $provider => $keys) {
            $submitted = $credentials[$provider] ?? [];

            if (! is_array($submitted)) {
                continue;
            }

            foreach ($keys as $key) {
                if (! array_key_exists($key, $submitted)) {
                    continue;
                }

                $value = (string) $submitted[$key];

                if ($value === '') {
                    KycCredentials::clear($provider, $key);
                    continue;
                }

                KycCredentials::set($provider, $key, $value);
            }
        }
    }

    // ─── Creator Qualification Settings ───────────────────────────────────────

    private const QUALIFICATION_KEYS = [
        'enabled', 'follower_threshold', 'delay_amount', 'delay_unit',
        'enabled_providers', 'min_connected_accounts', 'combine_counts',
        'email_enabled', 'email_subject', 'email_content',
        'reminder_enabled', 'reminder_delay_hours', 'auto_expiry_hours',
    ];

    public function getCreatorQualification(): \Illuminate\Http\JsonResponse
    {
        $data = [];
        foreach (self::QUALIFICATION_KEYS as $key) {
            $data[$key] = \App\Models\AdminSetting::get("creator_qualification.{$key}");
        }

        // Decode JSON arrays
        if (isset($data['enabled_providers']) && is_string($data['enabled_providers'])) {
            $data['enabled_providers'] = json_decode($data['enabled_providers'], true) ?? [];
        }

        return response()->json(['data' => $data]);
    }

    public function updateCreatorQualification(\Illuminate\Http\Request $request): \Illuminate\Http\JsonResponse
    {
        $rules = [
            'enabled'                  => ['boolean'],
            'follower_threshold'       => ['integer', 'min:0'],
            'delay_amount'             => ['integer', 'min:0'],
            'delay_unit'               => ['string', 'in:hours,days'],
            'enabled_providers'        => ['array'],
            'enabled_providers.*'      => ['string'],
            'min_connected_accounts'   => ['integer', 'min:1'],
            'combine_counts'           => ['boolean'],
            'email_enabled'            => ['boolean'],
            'email_subject'            => ['string', 'max:255'],
            'email_content'            => ['string', 'max:5000'],
            'reminder_enabled'         => ['boolean'],
            'reminder_delay_hours'     => ['integer', 'min:1'],
            'auto_expiry_hours'        => ['integer', 'min:1'],
        ];

        $data = $request->validate($rules);

        foreach ($data as $key => $value) {
            $stored = is_array($value) ? json_encode($value) : (string) $value;
            \App\Models\AdminSetting::set("creator_qualification.{$key}", $stored);
        }

        return response()->json(['message' => 'Creator qualification settings updated.']);
    }

    // ─── Admin: Qualification Events ─────────────────────────────────────────

    public function listQualificationEvents(\Illuminate\Http\Request $request): \Illuminate\Http\JsonResponse
    {
        $events = \App\Models\CreatorQualificationEvent::with(['user:id,name,username,email', 'snapshot'])
            ->when($request->input('status'), fn ($q, $s) => $q->where('status', $s))
            ->orderByDesc('created_at')
            ->paginate(20);

        return response()->json($events);
    }

    public function notifyQualificationEvent(int $id): \Illuminate\Http\JsonResponse
    {
        $event = \App\Models\CreatorQualificationEvent::with(['user', 'snapshot'])->findOrFail($id);

        if (! in_array($event->status, ['pending', 'notified'], true)) {
            return response()->json(['message' => 'Event is not in a notifiable state.'], 422);
        }

        \App\Jobs\CheckCreatorQualification::dispatch($event->id)->delay(now()->addSeconds(5));

        return response()->json(['message' => 'Notification job dispatched.']);
    }

    public function listSocialAccounts(\Illuminate\Http\Request $request): \Illuminate\Http\JsonResponse
    {
        $accounts = \App\Models\SocialAccount::with('user:id,name,username,email')
            ->when($request->input('provider'), fn ($q, $p) => $q->where('provider', $p))
            ->orderByDesc('follower_count')
            ->paginate(25);

        return response()->json($accounts);
    }
}

