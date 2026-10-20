<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SecureCrmAuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_is_redirected_to_login_from_dashboard(): void
    {
        $this->get('/securecrm/overview')
            ->assertRedirect('/securecrm/login');
    }

    public function test_login_page_renders(): void
    {
        $this->get('/securecrm/login')
            ->assertOk()
            ->assertSee('Sign in to SecureCRM')
            ->assertSee('SecureCRM');
    }

    public function test_staff_can_log_in_with_valid_credentials(): void
    {
        $staff = StaffUser::factory()->create([
            'email' => 'agent@murihspace.com',
            'password' => Hash::make('secret-password'),
        ]);

        $this->post('/securecrm/login', [
            'email' => 'agent@murihspace.com',
            'password' => 'secret-password',
        ])->assertRedirect('/securecrm/overview');

        $this->assertAuthenticatedAs($staff, 'staff');

        $staff->refresh();
        $this->assertNotNull($staff->last_login_at);
    }

    public function test_invalid_credentials_are_rejected(): void
    {
        StaffUser::factory()->create([
            'email' => 'agent@securecrm.com',
            'password' => Hash::make('secret-password'),
        ]);

        $this->from('/securecrm/login')
            ->post('/securecrm/login', [
                'email' => 'agent@securecrm.com',
                'password' => 'wrong-password',
            ])
            ->assertRedirect('/securecrm/login')
            ->assertSessionHasErrors('email');

        $this->assertGuest('staff');
    }

    public function test_inactive_staff_cannot_log_in(): void
    {
        StaffUser::factory()->inactive()->create([
            'email' => 'inactive@securecrm.com',
            'password' => Hash::make('secret-password'),
        ]);

        $this->post('/securecrm/login', [
            'email' => 'inactive@securecrm.com',
            'password' => 'secret-password',
        ])->assertSessionHasErrors('email');

        $this->assertGuest('staff');
    }

    public function test_staff_can_log_out(): void
    {
        $staff = StaffUser::factory()->create();

        $this->actingAs($staff, 'staff')
            ->post('/securecrm/logout')
            ->assertRedirect('/securecrm/login');

        $this->assertGuest('staff');
    }

    public function test_five_failed_web_logins_lock_the_account(): void
    {
        $staff = StaffUser::factory()->create([
            'email' => 'lockout@securecrm.com',
            'password' => Hash::make('secret-password'),
        ]);

        for ($attempt = 1; $attempt <= 5; $attempt++) {
            $this->post('/securecrm/login', [
                'email' => 'lockout@securecrm.com',
                'password' => 'wrong-password',
            ])->assertSessionHasErrors('email');
        }

        $staff->refresh();
        $this->assertSame(5, (int) $staff->failed_login_attempts);
        $this->assertTrue($staff->isLocked());

        // While locked, the correct password is refused too.
        $this->post('/securecrm/login', [
            'email' => 'lockout@securecrm.com',
            'password' => 'secret-password',
        ])->assertSessionHasErrors('email');

        $this->assertGuest('staff');
    }

    public function test_a_successful_web_login_resets_the_failure_count(): void
    {
        $staff = StaffUser::factory()->create([
            'email' => 'reset@securecrm.com',
            'password' => Hash::make('secret-password'),
        ]);

        for ($attempt = 1; $attempt <= 3; $attempt++) {
            $this->post('/securecrm/login', ['email' => 'reset@securecrm.com', 'password' => 'wrong-password']);
        }

        $this->post('/securecrm/login', ['email' => 'reset@securecrm.com', 'password' => 'secret-password'])
            ->assertRedirect('/securecrm/overview');

        $staff->refresh();
        $this->assertSame(0, (int) $staff->failed_login_attempts);
        $this->assertFalse($staff->isLocked());
    }

    public function test_a_disabled_account_is_refused_even_with_the_right_password(): void
    {
        $staff = StaffUser::factory()->inactive()->create([
            'email' => 'disabled-web@securecrm.com',
            'password' => Hash::make('secret-password'),
        ]);

        $this->post('/securecrm/login', [
            'email' => 'disabled-web@securecrm.com',
            'password' => 'secret-password',
        ])->assertSessionHasErrors('email');

        $this->assertGuest('staff');
        $this->assertNull($staff->fresh()->last_login_at);
    }
}
