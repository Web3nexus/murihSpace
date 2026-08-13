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
}
