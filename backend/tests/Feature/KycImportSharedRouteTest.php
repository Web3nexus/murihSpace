<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class KycImportSharedRouteTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('kyc.didit.enabled', true);
        Config::set('kyc.didit.api_key', 'test-api-key');
        Config::set('kyc.didit.workflow_id', 'workflow-1');
    }

    private function signedInUser(): array
    {
        $user = User::factory()->create(['name' => 'Ada Lovelace']);
        $user->forceFill(['email_verified_at' => now()])->save();
        $token = $user->createToken('auth-token')->plainTextToken;

        return [$user, $token];
    }

    public function test_signed_in_user_can_import_a_shared_verification(): void
    {
        Http::fake([
            'verification.didit.me/v3/session/import-shared/' => Http::response([
                'session_id' => 'cloned-route-1',
                'shared_from_session' => 'origin-route-1',
                'status' => 'Approved',
            ], 201),
            'verification.didit.me/v3/session/cloned-route-1/decision/' => Http::response([
                'status' => 'Approved',
                'id_verifications' => [['first_name' => 'Ada', 'last_name' => 'Lovelace']],
            ]),
        ]);

        [$user, $token] = $this->signedInUser();

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/kyc/import-shared', ['share_token' => 'share-token-route-1'])
            ->assertOk()
            ->assertJsonPath('data.kyc_status', 'verified')
            ->assertJsonPath('data.ownership_required', true);

        $this->assertTrue($user->fresh()->requires_ownership_check);
    }

    public function test_rejected_token_returns_a_clear_message(): void
    {
        Http::fake([
            'verification.didit.me/v3/session/import-shared/' => Http::response([
                'share_token' => ['Share token has expired.'],
            ], 400),
        ]);

        [, $token] = $this->signedInUser();

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/kyc/import-shared', ['share_token' => 'expired-token'])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This shared verification could not be imported. Request a new one from MurihPay and try again.');
    }

    public function test_import_requires_a_token(): void
    {
        [, $token] = $this->signedInUser();

        $this->withHeader('Authorization', 'Bearer ' . $token)
            ->postJson('/api/v1/kyc/import-shared', [])
            ->assertStatus(422);
    }
}
