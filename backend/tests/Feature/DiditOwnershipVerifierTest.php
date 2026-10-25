<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Kyc\Didit\DiditOwnershipVerifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class DiditOwnershipVerifierTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('kyc.didit.enabled', true);
        Config::set('kyc.didit.api_key', 'test-api-key');
        Config::set('kyc.didit.workflow_id', 'workflow-1');
        Config::set('kyc.didit.ownership_workflow_id', 'face-workflow-1');
    }

    public function test_start_opens_face_match_session_for_this_users_vendor_data(): void
    {
        Http::fake([
            'verification.didit.me/v3/session/' => Http::response([
                'session_id' => 'owner-sess-1',
                'url' => 'https://verify.didit.me/s/abc',
            ], 201),
        ]);

        $user = User::factory()->create();

        $session = app(DiditOwnershipVerifier::class)->start($user);

        $this->assertSame('owner-sess-1', $session['session_id']);
        $this->assertSame('owner-sess-1', $user->fresh()->ownership_session_id);

        Http::assertSent(function ($request) use ($user) {
            return $request['workflow_id'] === 'face-workflow-1'
                && $request['vendor_data'] === 'murihspace_user_' . $user->uuid;
        });
    }

    public function test_approved_selfie_confirms_ownership_for_this_sign_in(): void
    {
        $user = $this->accountNeedingOwnerCheck();
        $user->forceFill(['ownership_session_id' => 'owner-sess-2'])->save();

        Http::fake([
            'verification.didit.me/v3/session/owner-sess-2/decision/' => Http::response([
                'status' => 'Approved',
                'vendor_data' => 'murihspace_user_' . $user->uuid,
            ]),
        ]);

        $this->assertSame('confirmed', app(DiditOwnershipVerifier::class)->check($user, 42));

        $user->refresh();
        $this->assertNotNull($user->ownership_confirmed_at);
        $this->assertSame(42, $user->ownership_token_id);
        $this->assertNull($user->ownership_session_id);
    }

    public function test_declined_selfie_does_not_confirm_and_clears_session(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['ownership_session_id' => 'owner-sess-3'])->save();

        Http::fake([
            'verification.didit.me/v3/session/owner-sess-3/decision/' => Http::response([
                'status' => 'Declined',
                'vendor_data' => 'murihspace_user_' . $user->uuid,
            ]),
        ]);

        $this->assertSame('declined', app(DiditOwnershipVerifier::class)->check($user, 42));

        $user->refresh();
        $this->assertNull($user->ownership_confirmed_at);
        $this->assertNull($user->ownership_session_id);
    }

    public function test_decision_for_another_user_is_rejected(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['ownership_session_id' => 'owner-sess-4'])->save();

        Http::fake([
            'verification.didit.me/v3/session/owner-sess-4/decision/' => Http::response([
                'status' => 'Approved',
                'vendor_data' => 'murihspace_user_someone-else',
            ]),
        ]);

        $this->assertSame('declined', app(DiditOwnershipVerifier::class)->check($user, 42));
        $this->assertNull($user->fresh()->ownership_confirmed_at);
    }

    public function test_confirmation_does_not_carry_over_to_another_sign_in(): void
    {
        $user = $this->accountNeedingOwnerCheck();
        $user->forceFill(['ownership_confirmed_at' => now(), 'ownership_token_id' => 7])->save();

        $verifier = app(DiditOwnershipVerifier::class);

        $this->assertTrue($verifier->isConfirmedFor($user->fresh(), 7));
        $this->assertFalse($verifier->isConfirmedFor($user->fresh(), 8));
    }

    /**
     * Factory create() mass-assigns through $fillable, so set the flag explicitly.
     */
    private function accountNeedingOwnerCheck(): User
    {
        $user = User::factory()->create();
        // EnsureEmailIsVerified runs before the ownership gate, so verify the email too.
        $user->forceFill(['requires_ownership_check' => true, 'email_verified_at' => now()])->save();

        return $user;
    }

    public function test_ownership_cannot_be_set_through_mass_assignment(): void
    {
        $user = User::factory()->create();

        $user->fill(['ownership_confirmed_at' => now(), 'requires_ownership_check' => false])->save();

        $this->assertNull($user->fresh()->ownership_confirmed_at);
    }

    public function test_money_movement_is_blocked_until_this_sign_in_passes_owner_check(): void
    {
        $user = $this->accountNeedingOwnerCheck();
        $token = $user->createToken('auth-token');

        $this->withHeader('Authorization', 'Bearer ' . $token->plainTextToken)
            ->postJson('/api/v1/wallet/transfers/send', [])
            ->assertStatus(403)
            ->assertJsonPath('errors.code', 'OWNERSHIP_REQUIRED');

        // Confirmed on a different sign-in: still blocked.
        $user->forceFill(['ownership_confirmed_at' => now(), 'ownership_token_id' => $token->accessToken->getKey() + 1])->save();

        $this->withHeader('Authorization', 'Bearer ' . $token->plainTextToken)
            ->postJson('/api/v1/wallet/transfers/send', [])
            ->assertJsonPath('errors.code', 'OWNERSHIP_REQUIRED');
    }

    public function test_money_movement_passes_gate_after_owner_check_on_this_sign_in(): void
    {
        $user = $this->accountNeedingOwnerCheck();
        $token = $user->createToken('auth-token');

        $user->forceFill(['ownership_confirmed_at' => now(), 'ownership_token_id' => $token->accessToken->getKey()])->save();

        $this->withHeader('Authorization', 'Bearer ' . $token->plainTextToken)
            ->postJson('/api/v1/wallet/transfers/send', [])
            ->assertJsonMissingPath('errors.code');
    }
}
