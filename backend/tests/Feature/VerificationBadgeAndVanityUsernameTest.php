<?php

namespace Tests\Feature;

use App\Models\AdminSetting;
use App\Models\User;
use App\Support\AdminSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VerificationBadgeAndVanityUsernameTest extends TestCase
{
    use RefreshDatabase;

    public function test_verification_badge_status_returns_vanity_url_and_pricing_metadata(): void
    {
        $user = User::factory()->create([
            'username' => 'demouser',
            'is_premium' => true,
            'verification_badge_status' => 'active',
            'verification_badge_expires_at' => now()->addDays(30),
        ]);

        AdminSetting::set('verification_badge_fee', 25);

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/verification-badge/status');

        $response->assertOk();
        $payload = $response->json('data.data') ?? $response->json('data');
        $this->assertEquals('active', $payload['status']);
        $this->assertTrue($payload['has_premium_username']);
        $this->assertEquals('https://murih.me/@demouser', $payload['vanity_profile_url']);
        $this->assertEquals('murih.me', $payload['canonical_domain']);
        $this->assertEquals(25, $payload['monthly_fee']);
    }

    public function test_admin_can_retrieve_and_update_pricing(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'super_admin',
        ]);

        $token = $admin->createToken('admin-token', ['*', AdminSession::ABILITY_MFA])->plainTextToken;

        $pricingResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->getJson('/api/v1/securegate/verification-badges/pricing');

        $pricingResponse->assertOk();

        $updateResponse = $this->withHeader('Authorization', 'Bearer ' . $token)
            ->putJson('/api/v1/securegate/verification-badges/pricing', [
                'monthly_fee' => 19,
                'annual_fee' => 199,
                'community_monthly_fee' => 49,
            ]);

        $updateResponse->assertOk();
        $payload = $updateResponse->json('data.data') ?? $updateResponse->json('data');
        $this->assertEquals(19, $payload['monthly']);
        $this->assertEquals(49, $payload['community_monthly']);

        $this->assertEquals(19, AdminSetting::get('verification_badge_fee'));
        $this->assertEquals(49, AdminSetting::get('community_verification_monthly_fee'));
    }
}

