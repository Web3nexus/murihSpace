<?php

namespace Tests\Feature;

use App\Models\PhoneChangeRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PhoneChangeVerificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_request_phone_change_and_receives_otp_challenge(): void
    {
        $user = User::factory()->create([
            'mobile_number' => '+2348011111111',
        ]);

        $res = $this->actingAs($user)->postJson('/api/v1/auth/phone/change-request', [
            'phone' => '+2348022222222',
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('data.new_phone', '+2348022222222')
            ->assertJsonStructure(['data' => ['request_id', 'new_phone', 'expires_at']]);

        $this->assertDatabaseHas('phone_change_requests', [
            'user_id' => $user->id,
            'new_phone_e164' => '+2348022222222',
            'status' => 'pending',
        ]);
    }

    public function test_duplicate_phone_number_is_rejected(): void
    {
        User::factory()->create(['mobile_number' => '+2348099999999']);
        $user = User::factory()->create(['mobile_number' => '+2348011111111']);

        $res = $this->actingAs($user)->postJson('/api/v1/auth/phone/change-request', [
            'phone' => '+2348099999999',
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['phone']);
    }

    public function test_correct_otp_atomically_updates_and_verifies_phone_number(): void
    {
        $user = User::factory()->create([
            'mobile_number' => '+2348011111111',
            'phone_verified_at' => now()->subMonths(1),
        ]);

        $otp = '742918';
        PhoneChangeRequest::create([
            'user_id' => $user->id,
            'old_phone' => '+2348011111111',
            'new_phone_e164' => '+2348055555555',
            'verification_code_hash' => hash('sha256', $otp),
            'status' => 'pending',
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
        ]);

        $res = $this->actingAs($user)->postJson('/api/v1/auth/phone/verify-change', [
            'code' => $otp,
        ]);

        $res->assertStatus(200)
            ->assertJsonPath('data.mobile_number', '+2348055555555')
            ->assertJsonPath('data.phone_verified', true);

        $this->assertEquals('+2348055555555', $user->fresh()->mobile_number);
        $this->assertNotNull($user->fresh()->phone_verified_at);
    }

    public function test_incorrect_otp_increments_attempts_and_rejects(): void
    {
        $user = User::factory()->create(['mobile_number' => '+2348011111111']);

        $otp = '123456';
        $req = PhoneChangeRequest::create([
            'user_id' => $user->id,
            'old_phone' => '+2348011111111',
            'new_phone_e164' => '+2348055555555',
            'verification_code_hash' => hash('sha256', $otp),
            'status' => 'pending',
            'attempts' => 0,
            'expires_at' => now()->addMinutes(10),
        ]);

        $res = $this->actingAs($user)->postJson('/api/v1/auth/phone/verify-change', [
            'code' => '999999',
        ]);

        $res->assertStatus(422)
            ->assertJsonValidationErrors(['code']);

        $this->assertEquals(1, $req->fresh()->attempts);
        $this->assertEquals('+2348011111111', $user->fresh()->mobile_number); // Unchanged
    }
}
