<?php

namespace Tests\Feature;

use App\Models\AdminSetting;
use App\Models\User;
use App\Services\Kyc\Didit\DiditApiClient;
use App\Services\Kyc\Didit\DiditWebhookSignatureVerifier;
use App\Services\Kyc\KycCredentials;
use App\Services\SumsubService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminSettingsKycCredentialsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Clear any config defaults for didit & sumsub
        Config::set('kyc.didit.api_key', '');
        Config::set('kyc.didit.workflow_id', '');
        Config::set('kyc.didit.webhook_secret', '');
        Config::set('sumsub.app_token', '');
        Config::set('sumsub.secret_key', '');
        Config::set('sumsub.webhook_secret', '');
    }

    public function test_kyc_credentials_helper_encrypts_and_resolves_credentials(): void
    {
        $this->assertFalse(KycCredentials::isSet('didit', 'api_key'));
        $this->assertEquals('default-val', KycCredentials::resolve('didit', 'api_key', 'default-val'));

        KycCredentials::set('didit', 'api_key', 'secret-api-key-123');

        $this->assertTrue(KycCredentials::isSet('didit', 'api_key'));
        $this->assertEquals('secret-api-key-123', KycCredentials::resolve('didit', 'api_key'));

        // Verify stored value in database is encrypted
        $setting = AdminSetting::where('key', 'kyc_didit_api_key')->first();
        $this->assertNotNull($setting);
        $this->assertNotEquals('secret-api-key-123', $setting->value);
        $this->assertEquals('secret-api-key-123', Crypt::decryptString($setting->value));

        // Test clear
        KycCredentials::clear('didit', 'api_key');
        $this->assertFalse(KycCredentials::isSet('didit', 'api_key'));
    }

    public function test_admin_settings_api_exposes_and_persists_kyc_credentials(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        // GET settings initially shows all credentials as false (not set)
        $response = $this->getJson('/api/v1/securegate/settings');
        $response->assertStatus(200);

        $json = $response->json();
        $data = $json['data']['data'] ?? $json['data'];

        $this->assertFalse($data['kyc_credentials']['didit']['api_key']);
        $this->assertFalse($data['kyc_credentials']['sumsub']['app_token']);

        // PUT settings with new credentials
        $updateResponse = $this->putJson('/api/v1/securegate/settings', [
            'kyc_credentials' => [
                'didit' => [
                    'api_key' => 'didit-key-xyz',
                    'workflow_id' => 'wf-100',
                ],
                'sumsub' => [
                    'app_token' => 'sumsub-app-token-999',
                    'secret_key' => 'sumsub-secret-key-888',
                ],
            ],
            'kyc_providers' => ['didit', 'sumsub', 'manual'],
        ]);

        $updateResponse->assertStatus(200);
        $updateJson = $updateResponse->json();
        $updatedData = $updateJson['data']['data'] ?? $updateJson['data'];

        $this->assertTrue($updatedData['kyc_credentials']['didit']['api_key']);
        $this->assertTrue($updatedData['kyc_credentials']['didit']['workflow_id']);
        $this->assertTrue($updatedData['kyc_credentials']['sumsub']['app_token']);
        $this->assertTrue($updatedData['kyc_credentials']['sumsub']['secret_key']);

        // Verify available providers return enabled = true
        $diditAvail = collect($updatedData['kyc_providers_available'])->firstWhere('name', 'didit');
        $sumsubAvail = collect($updatedData['kyc_providers_available'])->firstWhere('name', 'sumsub');

        $this->assertTrue($diditAvail['enabled']);
        $this->assertTrue($sumsubAvail['enabled']);
    }

    public function test_didit_and_sumsub_services_resolve_from_admin_settings(): void
    {
        // Initially clients are not enabled because no credentials exist
        $diditClient = app(DiditApiClient::class);
        $sumsubService = app(SumsubService::class);

        $this->assertFalse($diditClient->isEnabled());
        $this->assertFalse($sumsubService->isEnabled());

        // Set credentials via helper
        KycCredentials::set('didit', 'api_key', 'didit-key-live');
        KycCredentials::set('didit', 'workflow_id', 'wf-live');
        KycCredentials::set('didit', 'webhook_secret', 'whsec-live');
        KycCredentials::set('sumsub', 'app_token', 'token-live');
        KycCredentials::set('sumsub', 'secret_key', 'secret-live');
        KycCredentials::set('sumsub', 'webhook_secret', 'whsec-sumsub-live');

        $this->assertTrue($diditClient->isEnabled());
        $this->assertTrue($sumsubService->isEnabled());

        // Test webhook verifier with admin setting secret
        $verifier = app(DiditWebhookSignatureVerifier::class);
        $ts = time();
        $session = 'sess-123';
        $status = 'APPROVED';
        $type = 'session.completed';

        $payload = json_encode([
            'sessionId' => $session,
            'type' => $type,
            'status' => $status,
            'timestamp' => $ts,
        ]);

        $sig = hash_hmac('sha256', $payload, 'whsec-live');

        $result = $verifier->verify(
            $payload,
            ['x-signature' => $sig]
        );

        // Signatures verified successfully using webhook secret stored in AdminSetting
        $this->assertNotNull($result);
        $this->assertEquals($session, $result->sessionId);
    }
}
