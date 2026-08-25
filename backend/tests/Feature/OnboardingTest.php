<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OnboardingTest extends TestCase
{
    use RefreshDatabase;

    public function test_member_receives_lightweight_onboarding_config(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        $response = $this->actingAs($user)->getJson('/api/v1/onboarding/config');

        $response->assertStatus(200)
            ->assertJsonPath('data.data.role', 'member')
            ->assertJsonPath('data.data.is_business', false)
            ->assertJsonCount(3, 'data.data.steps');
    }

    public function test_creator_receives_creator_onboarding_config(): void
    {
        $user = User::factory()->create(['role' => 'creator']);

        $response = $this->actingAs($user)->getJson('/api/v1/onboarding/config');

        $response->assertStatus(200)
            ->assertJsonPath('data.data.role', 'creator')
            ->assertJsonPath('data.data.is_business', true)
            ->assertJsonCount(5, 'data.data.steps');
    }

    public function test_vendor_receives_vendor_onboarding_config(): void
    {
        $user = User::factory()->create(['role' => 'vendor']);

        $response = $this->actingAs($user)->getJson('/api/v1/onboarding/config');

        $response->assertStatus(200)
            ->assertJsonPath('data.data.role', 'vendor')
            ->assertJsonPath('data.data.is_business', true)
            ->assertJsonPath('data.data.steps.0.key', 'business');
    }

    public function test_saving_onboarding_progress_persists_to_ai_memory(): void
    {
        $user = User::factory()->create(['role' => 'creator']);

        $response = $this->actingAs($user)->postJson('/api/v1/onboarding/progress', [
            'step' => 2,
            'form_data' => ['niche' => 'Fitness'],
        ]);

        $response->assertStatus(200);

        // Verify progress is returned in config
        $configResponse = $this->actingAs($user)->getJson('/api/v1/onboarding/config');
        $configResponse->assertStatus(200)
            ->assertJsonPath('data.data.saved_progress.step', 2);
    }

    public function test_saving_onboarding_progress_handles_missing_or_optional_step_gracefully(): void
    {
        $user = User::factory()->create(['role' => 'member']);

        // Empty body / missing step should default to step 0 instead of returning 422
        $response = $this->actingAs($user)->postJson('/api/v1/onboarding/progress', []);

        $response->assertStatus(200)
            ->assertJsonPath('data.step', 0);
    }

    public function test_vendor_can_save_vendor_business_info(): void
    {
        $vendor = User::factory()->create(['role' => 'vendor']);

        $response = $this->actingAs($vendor)->postJson('/api/v1/onboarding/vendor-info', [
            'business_name' => 'Acme Apparel',
            'business_category' => 'Apparel & Fashion',
            'fulfilment_model' => 'Self-fulfilled (hand-shipped)',
            'bio' => 'Quality clothing made with love.',
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('storefronts', [
            'user_id' => $vendor->id,
            'name' => 'Acme Apparel',
        ]);
    }

    public function test_member_can_complete_member_setup(): void
    {
        $member = User::factory()->create(['role' => 'member']);

        $response = $this->actingAs($member)->postJson('/api/v1/onboarding/member-setup', [
            'interests' => ['Gaming', 'Tech & Coding'],
            'notification_preferences' => ['feed' => true],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.data.onboarding_completed', true);

        $this->assertNotNull($member->fresh()->creatorProfile?->onboarding_completed_at);
    }
}
