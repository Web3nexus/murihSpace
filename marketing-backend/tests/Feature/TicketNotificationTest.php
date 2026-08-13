<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use App\Models\SupportSetting;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Notifications\StaffEscalationMail;
use App\Services\TicketConversationService;
use App\Services\TicketNotifier;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class TicketNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.main_backend.base_url' => 'http://backend.test',
            'services.main_backend.token' => 'secret-token',
        ]);
    }

    private function fakeBackend(bool $delivered = true): void
    {
        Http::fake([
            'backend.test/internal/support/notifications' => Http::response([
                'success' => true,
                'delivered' => $delivered,
                'user_id' => 7,
            ], 200),
        ]);
    }

    public function test_help_center_form_creation_notifies_customer_and_staff(): void
    {
        $this->fakeBackend();
        $agent = StaffUser::factory()->role('support_agent')->create();
        $category = TicketCategory::factory()->create(['slug' => 'payments.billing']);

        $this->postJson('/api/public/help/tickets', [
            'subject' => 'Double charge',
            'description' => 'I was charged twice.',
            'email' => 'customer@example.com',
            'category_slug' => 'payments.billing',
        ])->assertCreated();

        $ticket = Ticket::first();
        $this->assertSame('customer@example.com', $ticket->customer_email);

        Http::assertSent(function (Request $request) use ($ticket) {
            $payload = $request->data();

            return $request->url() === 'http://backend.test/internal/support/notifications'
                && ($payload['email'] ?? null) === 'customer@example.com'
                && ($payload['type'] ?? null) === 'ticket_created'
                && ($payload['action_url'] ?? null) === '/app/messages/support'
                && ($payload['ticket_number'] ?? null) === $ticket->ticket_number;
        });

        $this->assertSame(1, DatabaseNotification::count());
        $notification = $agent->notifications()->first();
        $this->assertNotNull($notification);
        $this->assertSame('ticket_created', $notification->data['type']);
        $this->assertSame("New ticket {$ticket->ticket_number}", $notification->data['title']);
    }

    public function test_help_center_creation_without_account_email_still_alerts_staff(): void
    {
        $this->fakeBackend(false);
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->postJson('/api/public/help/tickets', [
            'subject' => 'Hello',
            'description' => 'World',
            'email' => 'visitor@example.com',
        ])->assertCreated();

        $this->assertSame(1, $agent->notifications()->count());
    }

    public function test_agent_reply_notifies_customer(): void
    {
        $this->fakeBackend();
        $agent = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create(['customer_email' => 'customer@example.com']);

        app(TicketConversationService::class)->addMessage($ticket, 'reply', 'We are looking into this.', $agent);

        Http::assertSent(function (Request $request) {
            $payload = $request->data();

            return ($payload['type'] ?? null) === 'ticket_reply'
                && ($payload['message'] ?? null) === 'We are looking into this.'
                && ($payload['email'] ?? null) === 'customer@example.com';
        });
    }

    public function test_customer_reply_notifies_assigned_agent_only(): void
    {
        Http::fake();
        $assigned = StaffUser::factory()->role('support_agent')->create();
        $other = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create([
            'customer_email' => 'customer@example.com',
            'assigned_agent_id' => $assigned->id,
        ]);

        app(TicketConversationService::class)->addMessage($ticket, 'customer_message', 'Still broken.');

        $this->assertSame(1, $assigned->notifications()->count());
        $this->assertSame('customer_reply', $assigned->notifications()->first()->data['type']);
        $this->assertSame(0, $other->notifications()->count());
    }

    public function test_status_changed_to_resolved_notifies_customer(): void
    {
        $this->fakeBackend();
        $agent = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create([
            'customer_email' => 'customer@example.com',
            'status' => 'open',
        ]);

        app(TicketConversationService::class)->changeStatus($ticket, 'resolved', $agent);

        Http::assertSent(function (Request $request) {
            $payload = $request->data();

            return ($payload['type'] ?? null) === 'ticket_resolved'
                && str_contains((string) ($payload['title'] ?? ''), 'resolved');
        });
    }

    public function test_status_changed_to_escalated_sends_critical_escalation(): void
    {
        Http::fake();
        Notification::fake();
        SupportSetting::set('staff_notify_email', 'ops@murihspace.com');
        SupportSetting::set('staff_notify_telegram_bot_token', 'bot-token');
        SupportSetting::set('staff_notify_telegram_chat_id', 'chat-123');
        $agent = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create([
            'customer_email' => 'customer@example.com',
            'status' => 'open',
        ]);

        app(TicketConversationService::class)->changeStatus($ticket, 'escalated', $agent);

        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'api.telegram.org/botbot-token/sendMessage'));

        Notification::assertSentTo(
            new AnonymousNotifiable,
            StaffEscalationMail::class,
            fn ($notification, $channels, $notifiable) => ($notifiable->routes['mail'] ?? null) === 'ops@murihspace.com'
        );
    }

    public function test_assignment_notifies_the_agent(): void
    {
        Http::fake();
        $assigned = StaffUser::factory()->role('support_agent')->create();
        $admin = StaffUser::factory()->admin()->create();
        $ticket = Ticket::factory()->create(['status' => 'new']);

        app(TicketConversationService::class)->assign($ticket, $assigned, $admin);

        $this->assertSame(1, $assigned->notifications()->count());
        $this->assertSame('ticket_assigned', $assigned->notifications()->first()->data['type']);
        $this->assertSame(0, $admin->notifications()->count());
    }

    public function test_critical_priority_new_ticket_escalates_to_email_and_telegram(): void
    {
        Http::fake();
        Notification::fake();
        SupportSetting::set('staff_notify_email', 'ops@murihspace.com');
        SupportSetting::set('staff_notify_telegram_bot_token', 'bot-token');
        SupportSetting::set('staff_notify_telegram_chat_id', 'chat-123');
        StaffUser::factory()->role('support_agent')->create();

        $this->postJson('/api/public/help/tickets', [
            'subject' => 'Site is down',
            'description' => 'Emergency.',
            'email' => 'customer@example.com',
            'priority' => 'critical',
        ])->assertCreated();

        Notification::assertSentTo(new AnonymousNotifiable, StaffEscalationMail::class);
        Http::assertSent(fn (Request $request) => str_contains($request->url(), 'api.telegram.org'));
    }

    public function test_normal_priority_new_ticket_does_not_escalate(): void
    {
        Http::fake();
        Notification::fake();
        StaffUser::factory()->role('support_agent')->create();

        $this->postJson('/api/public/help/tickets', [
            'subject' => 'Hello',
            'description' => 'World',
            'email' => 'customer@example.com',
        ])->assertCreated();

        Notification::assertNotSentTo(new AnonymousNotifiable, StaffEscalationMail::class);
        Http::assertNotSent(fn (Request $request) => str_contains($request->url(), 'api.telegram.org'));
    }

    public function test_backend_failure_is_best_effort_and_never_throws(): void
    {
        Http::fake([
            'backend.test/*' => Http::response([], 500),
        ]);
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->postJson('/api/public/help/tickets', [
            'subject' => 'Hello',
            'description' => 'World',
            'email' => 'customer@example.com',
        ])->assertCreated();

        $this->assertSame(1, $agent->notifications()->count());
    }

    public function test_ticket_without_customer_email_skips_customer_notification(): void
    {
        Http::fake();
        $agent = StaffUser::factory()->role('support_agent')->create();
        $ticket = Ticket::factory()->create(['customer_email' => null]);

        app(TicketNotifier::class)->ticketCreated($ticket);

        Http::assertNothingSent();
        $this->assertSame(1, $agent->notifications()->count());
    }
}
