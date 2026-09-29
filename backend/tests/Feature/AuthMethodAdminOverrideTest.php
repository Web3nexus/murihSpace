<?php

namespace Tests\Feature;

use App\Models\AdminSetting;
use App\Models\User;
use App\Services\AuthMethodConfigService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The email/password auth-method toggle governs member login, not admin login.
 *
 * POST /auth/login is the only login route in the app and the Securegate admin
 * portal (AdminLoginPage) posts to it too. Enforcing the toggle unconditionally
 * therefore locked every admin out whenever it was switched off.
 */
class AuthMethodAdminOverrideTest extends TestCase
{
    use RefreshDatabase;

    private function disableEmailPasswordLogin(): void
    {
        AdminSetting::set(AuthMethodConfigService::SETTING_KEY, json_encode([
            'primary' => 'phone_otp',
            'methods' => [
                'phone_otp' => ['registration' => true, 'login' => true],
                'email_password' => ['registration' => false, 'login' => false],
            ],
        ]));
    }

    private function admin(string $email = 'admin@murihspace.com'): User
    {
        return User::factory()->create([
            'email' => $email,
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'status' => 'active',
        ]);
    }

    private function member(string $email = 'member@murihspace.com'): User
    {
        return User::factory()->create([
            'email' => $email,
            'password' => bcrypt('password123'),
            'role' => 'member',
            'status' => 'active',
        ]);
    }

    public function test_admin_can_log_in_with_email_password_while_the_method_is_disabled(): void
    {
        $this->disableEmailPasswordLogin();
        $admin = $this->admin();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@murihspace.com',
            'password' => 'password123',
        ]);

        $response->assertOk();
        $this->assertNotEmpty($response->json('data.token'));
        $this->assertSame($admin->id, $response->json('data.user.id'));

        // The token must actually work for the admin panel, not just be issued.
        $this->assertSame(
            'admin',
            $this->withToken($response->json('data.token'))->getJson('/api/v1/user')->json('data.role'),
        );
    }

    public function test_member_cannot_log_in_with_email_password_while_the_method_is_disabled(): void
    {
        $this->disableEmailPasswordLogin();
        $this->member();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'member@murihspace.com',
            'password' => 'password123',
        ]);

        $response->assertStatus(422);
        $this->assertSame(
            'Email and password login is currently disabled. Use your phone number instead.',
            $response->json('errors.email.0'),
        );
    }

    public function test_disabled_state_does_not_reveal_whether_an_admin_account_exists(): void
    {
        // Otherwise the differing response would be an enumeration oracle for
        // admin accounts while the method is switched off.
        $this->disableEmailPasswordLogin();
        $this->admin();

        $wrongPassword = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@murihspace.com',
            'password' => 'not-the-password',
        ]);

        $noSuchAccount = $this->postJson('/api/v1/auth/login', [
            'email' => 'nobody@murihspace.com',
            'password' => 'not-the-password',
        ]);

        $this->assertSame(422, $wrongPassword->status());
        $this->assertSame(422, $noSuchAccount->status());
        $this->assertSame(
            $wrongPassword->json('errors.email.0'),
            $noSuchAccount->json('errors.email.0'),
        );
    }

    public function test_a_banned_admin_is_still_refused_while_the_method_is_disabled(): void
    {
        // The override only bypasses the *method* toggle. Account status is
        // still enforced by the normal path below it.
        $this->disableEmailPasswordLogin();
        $this->admin();
        User::where('email', 'admin@murihspace.com')->update(['status' => 'banned']);

        $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@murihspace.com',
            'password' => 'password123',
        ])->assertStatus(422);
    }

    public function test_admin_override_requires_the_correct_password(): void
    {
        $this->disableEmailPasswordLogin();
        $this->admin();

        $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@murihspace.com',
            'password' => 'wrong-password',
        ])->assertStatus(422);
    }

    public function test_member_email_login_still_works_when_the_method_is_enabled(): void
    {
        // Regression guard: the override must not change the enabled path.
        $member = $this->member();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'member@murihspace.com',
            'password' => 'password123',
        ]);

        $response->assertOk();
        $this->assertSame($member->id, $response->json('data.user.id'));
    }
}
