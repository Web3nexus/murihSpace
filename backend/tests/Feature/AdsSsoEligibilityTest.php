<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Ads Studio may only be signed into with a Creator, Vendor or Admin
 * MurihSpace account. Normal members must upgrade first; the SSO token
 * endpoint must refuse them and explain why.
 */
class AdsSsoEligibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_cannot_get_an_sso_token_and_is_told_to_upgrade(): void
    {
        $member = User::factory()->create(['role' => 'member']);
        Sanctum::actingAs($member);

        $this->postJson('/api/v1/ads/sso-token')
            ->assertStatus(403)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'You must upgrade your MurihSpace account to Creator or Vendor before you can use Ads Studio.')
            ->assertJsonPath('errors.status', 'error');
    }

    public function test_user_with_an_unknown_role_cannot_get_an_sso_token(): void
    {
        $user = User::factory()->create(['role' => 'guest']);
        Sanctum::actingAs($user);

        $this->postJson('/api/v1/ads/sso-token')
            ->assertStatus(403)
            ->assertJsonPath('success', false);
    }

    public function test_sso_launch_redirects_members_with_the_upgrade_error_in_the_url(): void
    {
        $member = User::factory()->create(['role' => 'member']);
        Sanctum::actingAs($member);

        $res = $this->get('/api/v1/ads/sso-launch');

        $res->assertRedirect();
        $this->assertStringContainsString('sso_error=upgrade_required', (string) $res->headers->get('Location'));
        $this->assertStringContainsString('upgrade', (string) $res->headers->get('Location'));
    }

    public function test_creator_vendor_and_admin_can_get_an_sso_token(): void
    {
        foreach (['creator', 'vendor', 'admin'] as $role) {
            $user = User::factory()->create(['role' => $role]);
            Sanctum::actingAs($user);

            $res = $this->postJson('/api/v1/ads/sso-token')
                ->assertOk()
                ->assertJsonPath('success', true);

            $this->assertNotEmpty($res->json('data.data.token'));
        }
    }
}