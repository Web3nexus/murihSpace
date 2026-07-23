<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_authenticated_user_can_fetch_profile(): void
    {
        $user = User::factory()->create([
            'username' => 'testuser',
            'role' => 'member',
            'country' => 'United Kingdom',
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/v1/profile');

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'username' => 'testuser',
                    'country' => 'United Kingdom',
                ]
            ]);
    }

    public function test_user_can_update_profile_details(): void
    {
        $user = User::factory()->create([
            'username' => 'originalusername',
            'bio' => 'Old bio',
        ]);

        Sanctum::actingAs($user);

        $response = $this->putJson('/api/v1/profile', [
            'name' => 'Updated Name',
            'username' => 'newusername',
            'bio' => 'New bio details',
            'country' => 'United States',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'name' => 'Updated Name',
                    'username' => 'newusername',
                    'bio' => 'New bio details',
                    'country' => 'United States',
                ]
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'username' => 'newusername',
            'bio' => 'New bio details',
        ]);
    }

    public function test_user_can_submit_kyc_document(): void
    {
        $user = User::factory()->create([
            'role' => 'creator',
            'kyc_status' => 'pending',
        ]);

        Sanctum::actingAs($user);

        $response = $this->postJson('/api/v1/profile/kyc', [
            'kyc_document' => 'PASSPORT-12345678',
        ]);

        $response->assertStatus(200)
            ->assertJson([
                'data' => [
                    'kyc_status' => 'pending',
                    'kyc_document' => 'PASSPORT-12345678',
                ]
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'kyc_status' => 'pending',
            'kyc_document' => 'PASSPORT-12345678',
        ]);
    }

    public function test_admin_can_list_and_approve_kyc_submissions(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'kyc_status' => 'verified']);
        $creator = User::factory()->create([
            'role' => 'creator',
            'kyc_status' => 'pending',
            'kyc_document' => 'DOC-999',
        ]);

        Sanctum::actingAs($admin);

        // List pending KYC
        $listResponse = $this->getJson('/api/v1/admin/kyc');
        $listResponse->assertStatus(200);

        // Approve KYC
        $approveResponse = $this->postJson("/api/v1/admin/kyc/{$creator->id}/approve");
        $approveResponse->assertStatus(200)
            ->assertJson([
                'data' => [
                    'id' => $creator->id,
                    'kyc_status' => 'verified',
                ]
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $creator->id,
            'kyc_status' => 'verified',
        ]);
    }

    public function test_admin_can_reject_kyc_submission_with_reason(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'kyc_status' => 'verified']);
        $creator = User::factory()->create([
            'role' => 'creator',
            'kyc_status' => 'pending',
            'kyc_document' => 'DOC-BLURRY',
        ]);

        Sanctum::actingAs($admin);

        $rejectResponse = $this->postJson("/api/v1/admin/kyc/{$creator->id}/reject", [
            'reason' => 'Document image is unreadable or blurry.',
        ]);

        $rejectResponse->assertStatus(200)
            ->assertJson([
                'data' => [
                    'id' => $creator->id,
                    'kyc_status' => 'rejected',
                    'kyc_rejection_reason' => 'Document image is unreadable or blurry.',
                ]
            ]);

        $this->assertDatabaseHas('users', [
            'id' => $creator->id,
            'kyc_status' => 'rejected',
            'kyc_rejection_reason' => 'Document image is unreadable or blurry.',
        ]);
    }
}
