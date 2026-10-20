<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class StaffApiLoginTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'correct-horse-42';

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('ip|127.0.0.1');
    }

    private function staff(array $attributes = []): StaffUser
    {
        return StaffUser::factory()->create(array_merge([
            'email' => 'agent@example.test',
            'password' => self::PASSWORD,
        ], $attributes));
    }

    private function login(string $email, string $password)
    {
        return $this->postJson('/api/staff/login', ['email' => $email, 'password' => $password]);
    }

    public function test_staff_can_log_in_and_receive_a_token_without_password_fields(): void
    {
        $staff = $this->staff();

        $response = $this->login('agent@example.test', self::PASSWORD)->assertOk()->assertJsonPath('success', true);

        $this->assertNotEmpty($response->json('data.token'));
        $this->assertSame('Bearer', $response->json('data.token_type'));
        $this->assertSame($staff->id, $response->json('data.staff.id'));
        $this->assertStringNotContainsString(self::PASSWORD, $response->getContent());
        $this->assertArrayNotHasKey('password', $response->json('data.staff'));
        $this->assertArrayNotHasKey('two_factor_secret', $response->json('data.staff'));

        $this->withToken($response->json('data.token'))
            ->getJson('/api/admin/staff')
            ->assertStatus(403); // a valid staff token is not enough without super admin
    }

    public function test_wrong_password_gets_a_generic_error_and_is_logged_without_the_password(): void
    {
        $this->staff();
        Log::spy();

        $this->login('agent@example.test', 'not-the-password')
            ->assertStatus(401)
            ->assertJsonPath('message', 'Invalid credentials.')
            ->assertJsonMissingPath('data.token');

        Log::shouldHaveReceived('warning')
            ->withArgs(fn (string $message, array $context) => $message === 'staff.api.login.failed'
                && $context['reason'] === 'bad_password'
                && ! in_array('not-the-password', $context, true)
                && ! str_contains(json_encode($context), 'not-the-password'))
            ->once();
    }

    public function test_unknown_email_gets_the_same_generic_error(): void
    {
        $this->login('nobody@example.test', self::PASSWORD)
            ->assertStatus(401)
            ->assertJsonPath('message', 'Invalid credentials.');
    }

    public function test_account_locks_after_repeated_failures_even_with_the_right_password(): void
    {
        $staff = $this->staff();
        $max = (int) config('staff.lockout.max_attempts');

        for ($i = 0; $i < $max; $i++) {
            $this->login('agent@example.test', 'wrong-'.$i)->assertStatus(401);
        }

        $staff->refresh();
        $this->assertTrue($staff->isLocked());

        $this->login('agent@example.test', self::PASSWORD)
            ->assertStatus(401)
            ->assertJsonPath('message', 'Invalid credentials.');
    }

    public function test_lock_expires_and_a_successful_login_resets_the_counter(): void
    {
        $staff = $this->staff(['failed_login_attempts' => 3]);

        $this->login('agent@example.test', self::PASSWORD)->assertOk();

        $staff->refresh();
        $this->assertSame(0, $staff->failed_login_attempts);
        $this->assertNull($staff->locked_until);
    }

    public function test_locked_account_recovers_after_the_lock_window(): void
    {
        $this->staff(['failed_login_attempts' => 5, 'locked_until' => now()->subMinute()]);

        $this->login('agent@example.test', self::PASSWORD)->assertOk();
    }

    public function test_disabled_staff_cannot_log_in(): void
    {
        $this->staff(['status' => StaffUser::STATUS_DISABLED]);

        $this->login('agent@example.test', self::PASSWORD)
            ->assertStatus(401)
            ->assertJsonPath('message', 'Invalid credentials.');
    }

    public function test_disabling_the_is_active_flag_also_disables_the_account(): void
    {
        $staff = $this->staff(['is_active' => false]);

        $this->assertSame(StaffUser::STATUS_DISABLED, $staff->fresh()->status);
        $this->login('agent@example.test', self::PASSWORD)->assertStatus(401);
    }

    public function test_login_requires_email_and_password(): void
    {
        $this->postJson('/api/staff/login', [])->assertStatus(422);
    }

    public function test_login_is_rate_limited_per_email_and_ip(): void
    {
        $this->staff();

        for ($i = 0; $i < 10; $i++) {
            $this->login('agent@example.test', 'wrong')->assertStatus(401);
        }

        $this->login('agent@example.test', 'wrong')->assertStatus(429);
    }

    public function test_logout_revokes_the_token(): void
    {
        $this->staff();
        $token = $this->login('agent@example.test', self::PASSWORD)->json('data.token');

        $this->withToken($token)->postJson('/api/staff/logout')->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/staff/logout')->assertStatus(401);
    }
}
