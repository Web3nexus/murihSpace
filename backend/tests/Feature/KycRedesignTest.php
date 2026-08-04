<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class KycRedesignTest extends TestCase
{
    use RefreshDatabase;

    public function test_basic_user_registration_completes_without_mandatory_kyc(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Free Member',
            'email' => 'freemember@murihspace.com',
            'username' => 'freemember',
            'role' => 'member',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertStatus(201);

        $user = User::where('email', 'freemember@murihspace.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('member', $user->role);
        $this->assertEquals('not_required', $user->kyc_status);
    }

    public function test_registration_with_creator_intent_triggers_role_application(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Aspiring Creator',
            'email' => 'creatorintent@murihspace.com',
            'username' => 'creatorintent',
            'role' => 'creator',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
        ]);

        $response->assertStatus(201);

        $user = User::where('email', 'creatorintent@murihspace.com')->first();
        $this->assertNotNull($user);
        $this->assertEquals('member', $user->role);
        $this->assertEquals('not_started', $user->kyc_status);

        $this->assertDatabaseHas('account_role_history', [
            'user_id' => $user->id,
            'requested_role' => 'creator',
            'status' => 'pending',
        ]);
    }

    public function test_kyc_triggers_endpoint_returns_active_triggers(): void
    {
        $user = User::factory()->create(['role' => 'member', 'kyc_status' => 'not_started']);

        app(\App\Services\RoleTransitionService::class)->apply($user, 'creator');

        $response = $this->actingAs($user)->getJson('/api/v1/kyc/triggers');

        $response->assertStatus(200)
            ->assertJsonStructure(['data' => ['kyc_status', 'required', 'triggers']])
            ->assertJson(['data' => ['required' => true]]);
    }

    public function test_verification_badge_application_requires_kyc(): void
    {
        $user = User::factory()->create(['role' => 'member', 'kyc_status' => 'not_required']);

        $response = $this->actingAs($user)->postJson('/api/v1/verification-badge/apply');

        $response->assertStatus(422)
            ->assertJson(['errors' => ['code' => 'KYC_REQUIRED', 'status' => 'kyc_pending']]);

        $this->assertEquals('kyc_pending', $user->fresh()->verification_badge_status);
    }

    public function test_verification_badge_application_submits_when_kyc_verified(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'verified']);

        // Give user wallet balance
        Wallet::create([
            'user_id' => $user->id,
            'wallet_type' => 'system',
            'available' => 100,
            'currency' => 'NGN',
        ]);

        config(['murihspace.verification_badge_fee' => 10]);

        $response = $this->actingAs($user)->postJson('/api/v1/verification-badge/apply');

        $response->assertStatus(201)
            ->assertJson(['data' => ['data' => ['status' => 'under_review']]]);

        $this->assertEquals('under_review', $user->fresh()->verification_badge_status);
    }

    public function test_admin_can_update_verification_badge_status(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $targetUser = User::factory()->create([
            'role' => 'creator',
            'kyc_status' => 'verified',
            'verification_badge_status' => 'under_review',
        ]);

        $response = $this->actingAs($admin)->patchJson("/api/v1/securegate/verification-badges/{$targetUser->id}/status", [
            'status' => 'verified',
        ]);

        $response->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertEquals('verified', $targetUser->fresh()->verification_badge_status);
    }
}
