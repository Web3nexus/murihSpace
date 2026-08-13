<?php

namespace App\Services;

use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\TicketMessage;
use Illuminate\Support\Facades\DB;

class TicketConversationService
{
    /**
     * Record an internal or customer-visible event on a ticket.
     */
    public function recordEvent(
        Ticket $ticket,
        string $event,
        ?StaffUser $actor = null,
        ?string $oldValue = null,
        ?string $newValue = null,
    ): TicketEvent {
        return TicketEvent::create([
            'ticket_id' => $ticket->id,
            'staff_user_id' => $actor?->id,
            'event' => $event,
            'old_value' => $oldValue,
            'new_value' => $newValue,
        ]);
    }

    /**
     * Agent/customer message that is visible to the customer.
     */
    public function addMessage(
        Ticket $ticket,
        string $type,
        string $body,
        ?StaffUser $staff = null,
        array $metadata = [],
    ): TicketMessage {
        $message = DB::transaction(function () use ($ticket, $type, $body, $staff, $metadata) {
            $message = TicketMessage::create([
                'ticket_id' => $ticket->id,
                'staff_user_id' => $staff?->id,
                'type' => $type,
                'body' => $body,
                'metadata' => $metadata ?: null,
            ]);

            // First agent response stamps first_response_at.
            if ($type === 'reply' && $staff && ! $ticket->first_response_at) {
                $ticket->forceFill(['first_response_at' => now()])->save();
            }

            DB::afterCommit(function () use ($ticket) {
                $this->runAutomation($ticket, 'updated');
            });

            return $message;
        });

        $notifier = app(TicketNotifier::class);

        if ($type === 'reply') {
            $notifier->agentReplied($ticket, $message);
        } elseif ($type === 'customer_message') {
            $notifier->customerReplied($ticket);
        }

        return $message;
    }

    /**
     * Change status with event + timestamp bookkeeping.
     */
    public function changeStatus(
        Ticket $ticket,
        string $newStatus,
        ?StaffUser $actor = null,
    ): TicketEvent {
        $oldStatus = $ticket->status;

        $event = DB::transaction(function () use ($ticket, $newStatus, $actor, $oldStatus) {
            $updates = ['status' => $newStatus];
            if ($newStatus === 'resolved') {
                $updates['resolved_at'] = $ticket->resolved_at ?? now();
            } elseif ($newStatus === 'closed') {
                $updates['closed_at'] = $ticket->closed_at ?? now();
            } elseif (in_array($newStatus, ['new', 'open', 'reopened'], true)) {
                $updates['resolved_at'] = null;
                $updates['closed_at'] = null;
            }

            $ticket->forceFill($updates)->save();

            $this->syncSlaPause($ticket, $newStatus);

            DB::afterCommit(function () use ($ticket) {
                $this->runAutomation($ticket, 'updated');
            });

            return $this->recordEvent(
                $ticket,
                $newStatus === 'escalated' ? 'escalated' : 'status_changed',
                $actor,
                $oldStatus,
                $newStatus,
            );
        });



        if ($oldStatus !== $newStatus) {
            app(TicketNotifier::class)->statusChanged($ticket, $oldStatus, $newStatus);
        }

        return $event;
    }

    /**
     * Assign (or reassign) the ticket to an agent.
     */
    public function assign(
        Ticket $ticket,
        ?StaffUser $agent,
        ?StaffUser $actor = null,
    ): TicketEvent {
        $event = DB::transaction(function () use ($ticket, $agent, $actor) {
            $oldValue = $ticket->assigned_agent_id ? (string) $ticket->assigned_agent_id : null;
            $newValue = $agent?->id ? (string) $agent->id : null;

            $ticket->forceFill(['assigned_agent_id' => $agent?->id])->save();

            if ($ticket->status === 'new') {
                $ticket->forceFill(['status' => 'open'])->save();
            }

            return $this->recordEvent($ticket, 'assigned', $actor, $oldValue, $newValue);
        });

        app(TicketNotifier::class)->assigned($ticket, $agent);

        return $event;
    }

    /**
     * Assign ticket to a team without an explicit agent.
     */
    public function assignTeam(Ticket $ticket, ?int $teamId, ?StaffUser $actor = null): TicketEvent
    {
        return DB::transaction(function () use ($ticket, $teamId, $actor) {
            $oldValue = $ticket->assigned_team_id ? (string) $ticket->assigned_team_id : null;
            $newValue = $teamId ? (string) $teamId : null;

            $ticket->forceFill(['assigned_team_id' => $teamId])->save();

            if ($ticket->status === 'new') {
                $ticket->forceFill(['status' => 'open'])->save();
            }

            return $this->recordEvent($ticket, 'team_assigned', $actor, $oldValue, $newValue);
        });
    }

    /**
     * Escalate the ticket.
     */
    public function escalate(Ticket $ticket, ?StaffUser $actor = null): TicketEvent
    {
        return $this->changeStatus($ticket, 'escalated', $actor);
    }

    /**
     * Run the automation engine for a trigger against a still-fresh ticket.
     */
    protected function runAutomation(Ticket $ticket, string $trigger): void
    {
        (new TicketAutomationEngine)->apply($ticket, $trigger);
    }

    /**
     * Pause/resume the SLA clock when a policy pauses on customer wait.
     */
    protected function syncSlaPause(Ticket $ticket, string $newStatus): void
    {
        $sla = new SlaService;
        $policy = $ticket->slaPolicy;

        if ($policy === null || ! $policy->pause_on_customer) {
            return;
        }

        if ($newStatus === 'pending_customer') {
            $sla->pause($ticket);

            return;
        }

        if ($newStatus !== 'resolved' && $newStatus !== 'closed') {
            $sla->resume($ticket);
        }
    }
}
