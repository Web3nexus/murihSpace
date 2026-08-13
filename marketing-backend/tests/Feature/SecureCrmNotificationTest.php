<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use App\Notifications\StaffTicketNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecureCrmNotificationTest extends TestCase
{
    use RefreshDatabase;

    private function makeAgentWithNotifications(): StaffUser
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $agent->notify(new StaffTicketNotification(
            'ticket_created',
            'New ticket MS-2026-000001',
            'Hello — from customer@example.com',
            '/securecrm/tickets/1',
            'MS-2026-000001',
        ));

        return $agent->fresh();
    }

    public function test_notifications_index_lists_in_app_notifications(): void
    {
        $agent = $this->makeAgentWithNotifications();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/notifications')
            ->assertOk()
            ->assertSee('New ticket MS-2026-000001')
            ->assertSee('Mark all read');
    }

    public function test_notifications_index_shows_empty_state(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/notifications')
            ->assertOk()
            ->assertSee('No unread notifications')
            ->assertSee('Ticket updates and alerts will show up here.');
    }

    public function test_mark_single_notification_as_read(): void
    {
        $agent = $this->makeAgentWithNotifications();
        $notification = $agent->notifications()->first();

        $this->actingAs($agent, 'staff')
            ->post("/securecrm/notifications/{$notification->id}/read")
            ->assertRedirect();

        $this->assertNotNull($agent->notifications()->first()->read_at);
    }

    public function test_mark_all_notifications_as_read(): void
    {
        $agent = $this->makeAgentWithNotifications();
        $agent->notify(new StaffTicketNotification('ticket_reply', 'New reply', 'Message', null, 'MS-2026-000001'));

        $this->actingAs($agent, 'staff')
            ->post('/securecrm/notifications/read-all')
            ->assertRedirect();

        $this->assertSame(0, $agent->unreadNotifications()->count());
        $this->assertSame(2, $agent->notifications()->count());
    }

    public function test_notifications_require_staff_auth(): void
    {
        $this->get('/securecrm/notifications')
            ->assertRedirect(route('securecrm.login'));
    }
}
