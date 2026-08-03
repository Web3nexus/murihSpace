<?php

namespace Tests\Feature;

use App\Jobs\CheckCreatorQualification;
use App\Models\AdminSetting;
use App\Models\CreatorQualificationEvent;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class SocialAccountTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_list_supported_providers(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        $response = $this->actingAs($user)->getJson('/api/v1/social-accounts/supported-providers');

        $response->assertStatus(200)
            ->assertJsonPath('data.data.0.provider', 'instagram');
    }

    public function test_user_can_manually_connect_social_account(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        $response = $this->actingAs($user)->postJson('/api/v1/social-accounts/manual', [
            'provider'       => 'instagram',
            'username'       => 'johndoe_official',
            'profile_url'    => 'https://instagram.com/johndoe_official',
            'follower_count' => 3500,
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.data.provider', 'instagram')
            ->assertJsonPath('data.data.follower_count', 3500);

        $this->assertDatabaseHas('social_accounts', [
            'user_id'  => $user->id,
            'provider' => 'instagram',
            'username' => 'johndoe_official',
        ]);
    }

    public function test_combined_followers_calculated_server_side(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        SocialAccount::create([
            'user_id'        => $user->id,
            'provider'       => 'instagram',
            'username'       => 'john_ig',
            'follower_count' => 4000,
            'sync_status'    => 'synced',
        ]);

        SocialAccount::create([
            'user_id'        => $user->id,
            'provider'       => 'youtube',
            'username'       => 'john_yt',
            'follower_count' => 7000,
            'sync_status'    => 'synced',
        ]);

        $response = $this->actingAs($user)->getJson('/api/v1/social-accounts/follower-summary');

        $response->assertStatus(200)
            ->assertJsonPath('data.data.combined_followers', 11000)
            ->assertJsonPath('data.data.provider_breakdown.instagram', 4000)
            ->assertJsonPath('data.data.provider_breakdown.youtube', 7000);
    }

    public function test_qualification_workflow_triggered_when_threshold_met(): void
    {
        Queue::fake();

        AdminSetting::set('creator_qualification.enabled', '1');
        AdminSetting::set('creator_qualification.follower_threshold', '10000');

        $user = User::factory()->create(['role' => 'member']);

        // Connecting accounts that cross threshold (5000 + 6000 = 11000 >= 10000)
        $this->actingAs($user)->postJson('/api/v1/social-accounts/manual', [
            'provider'       => 'instagram',
            'username'       => 'john_ig',
            'follower_count' => 5000,
        ]);

        $this->actingAs($user)->postJson('/api/v1/social-accounts/manual', [
            'provider'       => 'youtube',
            'username'       => 'john_yt',
            'follower_count' => 6000,
        ]);

        $this->assertDatabaseHas('creator_qualification_events', [
            'user_id' => $user->id,
            'status'  => 'pending',
        ]);

        Queue::assertPushed(CheckCreatorQualification::class);
    }

    public function test_admin_can_configure_creator_qualification_settings(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin)->putJson('/api/v1/securegate/creator-qualification/settings', [
            'enabled'                => true,
            'follower_threshold'     => 15000,
            'delay_amount'           => 12,
            'delay_unit'             => 'hours',
            'enabled_providers'      => ['instagram', 'youtube', 'tiktok'],
            'min_connected_accounts' => 2,
            'combine_counts'         => true,
            'email_enabled'          => true,
            'email_subject'          => 'Custom Qualification Subject',
            'email_content'          => 'Custom content body',
            'reminder_enabled'       => true,
            'reminder_delay_hours'   => 24,
            'auto_expiry_hours'      => 72,
        ]);

        $response->assertStatus(200);

        $this->assertEquals(15000, (int) AdminSetting::get('creator_qualification.follower_threshold'));
        $this->assertEquals('Custom Qualification Subject', AdminSetting::get('creator_qualification.email_subject'));
    }

    public function test_user_can_disconnect_social_account(): void
    {
        $user = User::factory()->create(['role' => 'member']);
        $account = SocialAccount::create([
            'user_id'        => $user->id,
            'provider'       => 'tiktok',
            'username'       => 'john_tt',
            'follower_count' => 1200,
            'sync_status'    => 'synced',
        ]);

        $response = $this->actingAs($user)->deleteJson("/api/v1/social-accounts/{$account->id}");

        $response->assertStatus(200);

        $this->assertDatabaseMissing('social_accounts', [
            'id' => $account->id,
        ]);
    }
}
