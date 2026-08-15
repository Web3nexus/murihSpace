<?php

namespace App\Http\Controllers;

use App\Models\AdminSetting;
use App\Services\AuthMethodConfigService;
use App\Services\OAuthProviderService;
use Illuminate\Http\JsonResponse;

class PlatformController extends Controller
{
    public function __construct(
        private readonly OAuthProviderService $oauth,
        private readonly AuthMethodConfigService $authMethods,
    ) {}

    /**
     * Public platform config used by the web login/registration and the
     * "locked to app" screens (no authentication required).
     */
    public function config(): JsonResponse
    {
        $disabledRoles = json_decode((string) AdminSetting::get('web_disabled_roles', '[]'), true);
        $downloadUrl = (string) config('app.app_download_url');
        $kycEnabled = (bool) AdminSetting::get('kyc_enabled', true);
        
        $kycProviders = json_decode((string) AdminSetting::get('kyc_providers', '["didit"]'), true);
        $activeKycProvider = is_array($kycProviders) && count($kycProviders) > 0 ? $kycProviders[0] : 'didit';

        $socialProviders = [];
        foreach ($this->oauth->providers() as $provider) {
            $socialProviders[$provider] = $this->oauth->isConfigured($provider);
        }

        return response()->json([
            'platform_name' => config('app.name'),
            'web_disabled_roles' => array_values(array_unique(is_array($disabledRoles) ? $disabledRoles : [])),
            'app_download_url' => $downloadUrl,
            'app_qr_content' => $downloadUrl,
            'kyc_enabled' => $kycEnabled,
            'kyc_provider' => $activeKycProvider,
            'social_providers' => $socialProviders,
            'auth_methods' => $this->authMethods->public(),
            'security_policy' => [
                'persistent_session'      => true, // WhatsApp style persistent auth
                'app_lock_required'       => true,
                'app_lock_mode'           => 'daily_or_launch',
                'transaction_pin_enabled' => true,
                'pin_setup_url'           => '/api/v1/wallet/pin/setup',
                'pin_update_url'          => '/api/v1/wallet/pin/update',
                'pin_verify_url'          => '/api/v1/wallet/pin/verify',
                'pin_status_url'          => '/api/v1/wallet/pin/status',
            ],
        ]);
    }
}
