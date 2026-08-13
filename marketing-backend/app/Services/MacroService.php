<?php

namespace App\Services;

use App\Models\Macro;
use App\Models\StaffUser;
use App\Models\SupportTeam;
use App\Models\Ticket;
use App\Models\TicketEvent;
use App\Models\TicketTag;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Applies a macro to a ticket. Macros are limited to a whitelist of safe
 * actions (reply, status, priority, tags, team) and each action requires the
 * actor to hold the same permission as doing it by hand, so a simple macro can
 * never quietly perform privileged or financial operations.
 */
class MacroService
{
    /**
     * Permission required for each macro action type.
     */
    public const ACTION_PERMISSIONS = [
        'insert_reply' => 'ticket.reply',
        'change_status' => 'ticket.close',
        'change_priority' => 'ticket.reply',
        'add_tag' => 'ticket.note',
        'assign_team' => 'ticket.assign',
    ];

    /**
     * Apply a macro to a ticket.
     *
     * @return array<int, string> the list of action types applied.
     *
     * @throws AuthorizationException when the actor lacks a permission that an
     *                                action of the macro requires.
     */
    public function apply(Macro $macro, Ticket $ticket, ?StaffUser $actor = null): array
    {
        $this->assertCanApply($macro, $actor);

        $applied = [];

        DB::transaction(function () use ($macro, $ticket, $actor, &$applied) {
            $replySent = false;

            foreach ($macro->actions ?? [] as $action) {
                $type = $action['type'] ?? null;
                $value = $action['value'] ?? null;

                if (! in_array($type, Macro::ACTION_TYPES, true)) {
                    continue;
                }

                if ($type === 'insert_reply') {
                    if ($value !== null && trim((string) $value) !== '') {
                        $this->insertReply($ticket, (string) $value, $actor);
                        $replySent = true;
                        $applied[] = 'insert_reply';
                    }

                    continue;
                }

                if ($this->runAction($ticket, $type, $value, $actor)) {
                    $applied[] = $type;
                }
            }

            // The macro body is the reply text and is sent whenever it is
            // present and no insert_reply action supplied its own text.
            if (! $replySent && $macro->body && trim($macro->body) !== '') {
                $this->insertReply($ticket, $macro->body, $actor);
                $applied[] = 'insert_reply';
            }

            $this->recordApplied($ticket, $macro, $actor);
        });

        return $applied;
    }

    /**
     * @throws AuthorizationException
     */
    protected function assertCanApply(Macro $macro, ?StaffUser $actor): void
    {
        if (! $macro->is_active) {
            throw new AuthorizationException('This macro is disabled.');
        }

        if ($actor === null) {
            return;
        }

        foreach (self::ACTION_PERMISSIONS as $type => $permission) {
            if ($this->usesAction($macro, $type) && ! $actor->hasPermission($permission)) {
                throw new AuthorizationException(
                    "You need the \"{$permission}\" permission to apply the \"{$type}\" macro action."
                );
            }
        }
    }

    protected function usesAction(Macro $macro, string $type): bool
    {
        foreach ($macro->actions ?? [] as $action) {
            if (($action['type'] ?? null) === $type) {
                return true;
            }
        }

        // A non-empty body is always sent as a reply, which implies
        // insert_reply permission even when no explicit action is present.
        return $type === 'insert_reply'
            && $macro->body
            && trim($macro->body) !== '';
    }

    protected function runAction(Ticket $ticket, string $type, mixed $value, ?StaffUser $actor): bool
    {
        return match ($type) {
            'insert_reply' => $this->insertReply($ticket, (string) $value, $actor),
            'change_status' => $this->changeStatus($ticket, (string) $value, $actor),
            'change_priority' => $this->changePriority($ticket, (string) $value, $actor),
            'add_tag' => $this->addTag($ticket, (string) $value),
            'assign_team' => $this->assignTeam($ticket, (string) $value, $actor),
            default => false,
        };
    }

    protected function insertReply(Ticket $ticket, string $body, ?StaffUser $actor): bool
    {
        if (trim($body) === '') {
            return false;
        }

        (new TicketConversationService)->addMessage($ticket, 'reply', $body, $actor);

        return true;
    }

    protected function changeStatus(Ticket $ticket, string $status, ?StaffUser $actor): bool
    {
        if (! in_array($status, Ticket::STATUSES, true) || $ticket->status === $status) {
            return false;
        }

        (new TicketConversationService)->changeStatus($ticket, $status, $actor);

        return true;
    }

    protected function changePriority(Ticket $ticket, string $priority, ?StaffUser $actor): bool
    {
        if (! in_array($priority, Ticket::PRIORITIES, true) || $ticket->priority === $priority) {
            return false;
        }

        $old = $ticket->priority;
        $ticket->forceFill(['priority' => $priority])->save();

        TicketEvent::create([
            'ticket_id' => $ticket->id,
            'staff_user_id' => $actor?->id,
            'event' => 'priority_changed',
            'old_value' => $old,
            'new_value' => $priority,
        ]);

        return true;
    }

    protected function addTag(Ticket $ticket, string $name): bool
    {
        $name = Str::lower(trim($name));

        if ($name === '') {
            return false;
        }

        TicketTag::firstOrCreate(['ticket_id' => $ticket->id, 'name' => $name]);

        return true;
    }

    protected function assignTeam(Ticket $ticket, string $teamId, ?StaffUser $actor): bool
    {
        $team = SupportTeam::query()->where('is_active', true)->find((int) $teamId);

        if (! $team || $ticket->assigned_team_id === $team->id) {
            return false;
        }

        (new TicketConversationService)->assignTeam($ticket, $team->id, $actor);

        return true;
    }

    protected function recordApplied(Ticket $ticket, Macro $macro, ?StaffUser $actor): void
    {
        TicketEvent::create([
            'ticket_id' => $ticket->id,
            'staff_user_id' => $actor?->id,
            'event' => 'macro_applied',
            'old_value' => null,
            'new_value' => $macro->name,
        ]);
    }
}
