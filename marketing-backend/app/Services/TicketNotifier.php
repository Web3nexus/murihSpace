<?php

namespace App\Services;

use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketMessage;

/**
 * Maps ticket lifecycle events to the right recipients and channels.
 *
 * Customers are notified in-app (and email where enabled) through the main
 * backend bridge. Staff are notified in-app via the SecureCRM bell; critical
 * events (escalated, critical-priority new tickets) are escalated to email +
 * Telegram through StaffAlertService.
 */
class TicketNotifier
{
    public function __construct(
        protected MainBackendService $mainBackend,
        protected StaffAlertService $staffAlert,
    ) {}

    /**
     * A new ticket was created (help centre form, app, staff-created, system).
     */
    public function ticketCreated(Ticket $ticket): void
    {
        $this->notifyCustomer($ticket, 'ticket_created', [
            'title' => "New ticket {$ticket->ticket_number}",
            'message' => "Your request \"{$ticket->subject}\" has been received.",
        ]);

        $this->staffAlert->notify([
            'type' => 'ticket_created',
            'title' => "New ticket {$ticket->ticket_number}",
            'message' => "{$ticket->subject} — from {$this->customerLabel($ticket)}",
            'action_url' => $this->ticketUrl($ticket),
            'ticket_number' => $ticket->ticket_number,
            'severity' => in_array($ticket->priority, ['urgent', 'critical'], true) ? 'critical' : 'normal',
        ]);
    }

    /**
     * An agent replied to the customer.
     */
    public function agentReplied(Ticket $ticket, TicketMessage $message): void
    {
        $this->notifyCustomer($ticket, 'ticket_reply', [
            'title' => "New reply on {$ticket->ticket_number}",
            'message' => mb_substr(strip_tags($message->body), 0, 140),
        ]);
    }

    /**
     * The customer replied — tell the assigned agent (or all support staff).
     */
    public function customerReplied(Ticket $ticket): void
    {
        $staff = $ticket->assigned_agent_id ? [$ticket->assigned_agent_id] : null;

        $this->staffAlert->notify([
            'type' => 'customer_reply',
            'title' => "Customer replied on {$ticket->ticket_number}",
            'message' => "{$ticket->subject} — from {$this->customerLabel($ticket)}",
            'action_url' => $this->ticketUrl($ticket),
            'ticket_number' => $ticket->ticket_number,
            'severity' => 'normal',
            'staff_ids' => $staff,
        ]);
    }

    /**
     * Status changed: resolved, reopened, more info requested, or general.
     */
    public function statusChanged(Ticket $ticket, string $oldStatus, string $newStatus): void
    {
        $customerNotification = match ($newStatus) {
            'resolved' => ['type' => 'ticket_resolved', 'title' => "Ticket {$ticket->ticket_number} resolved", 'message' => 'Your support request has been marked as resolved.'],
            'reopened' => ['type' => 'ticket_reopened', 'title' => "Ticket {$ticket->ticket_number} reopened", 'message' => 'Your support request has been reopened.'],
            'pending_customer' => ['type' => 'ticket_info_requested', 'title' => "More info needed on {$ticket->ticket_number}", 'message' => 'We need a bit more information to continue helping you.'],
            default => null,
        };

        if ($customerNotification !== null) {
            $this->notifyCustomer($ticket, $customerNotification['type'], $customerNotification);
        }

        if ($newStatus === 'escalated') {
            $this->staffAlert->notify([
                'type' => 'ticket_escalated',
                'title' => "Ticket {$ticket->ticket_number} escalated",
                'message' => "{$ticket->subject} — from {$this->customerLabel($ticket)}",
                'action_url' => $this->ticketUrl($ticket),
                'ticket_number' => $ticket->ticket_number,
                'severity' => 'critical',
            ]);
        }
    }

    /**
     * A ticket was assigned to an agent — notify that agent.
     */
    public function assigned(Ticket $ticket, ?StaffUser $agent): void
    {
        if (! $agent) {
            return;
        }

        $this->staffAlert->notify([
            'type' => 'ticket_assigned',
            'title' => "Ticket {$ticket->ticket_number} assigned to you",
            'message' => "{$ticket->subject} — from {$this->customerLabel($ticket)}",
            'action_url' => $this->ticketUrl($ticket),
            'ticket_number' => $ticket->ticket_number,
            'severity' => 'normal',
            'staff_ids' => [$agent->id],
        ]);
    }

    protected function notifyCustomer(Ticket $ticket, string $type, array $data): void
    {
        if (! $ticket->customer_email) {
            return;
        }

        $this->mainBackend->notifyCustomer([
            'email' => $ticket->customer_email,
            'type' => $type,
            'title' => $data['title'],
            'message' => $data['message'],
            'action_url' => $this->customerUrl(),
            'ticket_number' => $ticket->ticket_number,
        ]);
    }

    protected function customerUrl(): string
    {
        return '/app/messages/support';
    }

    protected function ticketUrl(Ticket $ticket): string
    {
        return route('securecrm.tickets.show', $ticket);
    }

    protected function customerLabel(Ticket $ticket): string
    {
        return $ticket->user_id ? "User #{$ticket->user_id}" : 'Anonymous';
    }
}
