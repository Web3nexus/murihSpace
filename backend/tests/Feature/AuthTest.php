<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test a user can register successfully.
     */
    public function test_user_can_register(): void
    {
        Event::fake();

        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Vincent Paul',
            'email' => 'vincent@murihspace.com',
            'username' => 'vincentpaul',
            'role' => 'member',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertStatus(201);
        $response->assertHeader('X-Request-ID');
        $response->assertJsonStructure([
            'success',
            'request_id',
            'data' => [
                'token',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'email_verified',
                ],
            ],
            'message',
            'errors',
        ]);

        $this->assertDatabaseHas('users', [
            'email' => 'vincent@murihspace.com',
        ]);

        Event::assertDispatched(Registered::class);
    }

    /**
     * Test registration validation errors.
     */
    public function test_registration_validation_fails(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => '',
            'email' => 'invalid-email',
            'password' => 'short',
            'password_confirmation' => 'mismatch',
        ]);

        $response->assertStatus(422);
        $response->assertJsonStructure([
            'success',
            'request_id',
            'data',
            'message',
            'errors' => [
                'name',
                'email',
                'password',
            ],
        ]);
    }

    /**
     * Test user can log in with correct credentials.
     */
    public function test_user_can_login(): void
    {
        $user = User::factory()->create([
            'email' => 'vincent@murihspace.com',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'vincent@murihspace.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure([
            'success',
            'request_id',
            'data' => [
                'token',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'email_verified',
                ],
            ],
            'message',
        ]);
    }

    /**
     * Test login fails with invalid credentials.
     */
    public function test_login_fails_with_invalid_credentials(): void
    {
        $user = User::factory()->create([
            'email' => 'vincent@murihspace.com',
            'password' => bcrypt('password123'),
        ]);

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'vincent@murihspace.com',
            'password' => 'wrong-password',
        ]);

        $response->assertStatus(422);
        $this->assertFalse($response->json('success'));
    }

    /**
     * Test authenticated user can log out.
     */
    public function test_user_can_logout(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test-token')->plainTextToken;

        $response = $this->withHeaders([
            'Authorization' => 'Bearer '.$token,
        ])->postJson('/api/v1/auth/logout');

        $response->assertStatus(200);
        $this->assertTrue($response->json('success'));
        $this->assertEquals(0, $user->tokens()->count());
    }

    /**
     * Test email verification endpoint.
     */
    public function test_email_can_be_verified(): void
    {
        $user = User::factory()->create([
            'email_verified_at' => null,
        ]);

        $verificationUrl = URL::temporarySignedRoute(
            'verification.verify',
            now()->addMinutes(60),
            ['id' => $user->id, 'hash' => sha1($user->getEmailForVerification())]
        );

        $apiVerificationUrl = parse_url($verificationUrl, PHP_URL_PATH)
            .'?'.parse_url($verificationUrl, PHP_URL_QUERY);

        $response = $this->getJson($apiVerificationUrl);

        $response->assertStatus(200);
        $this->assertTrue($response->json('success'));
        $this->assertTrue($user->fresh()->hasVerifiedEmail());
    }
}
