<?php

namespace App\Services;

use App\Models\StaffUser;
use App\Models\SupportTeam;
use App\Models\Ticket;
use Illuminate\Support\Facades\DB;

/**
 * Support-team assignment logic: manual reassignment, load-balanced
 * assignment to the least-loaded available member, availability toggling
 * and escalation helpers.
 */
class TeamService
{
    /**
     * Manually assign (or reassign) a ticket to a team.
     */
    public function assignTeam(Ticket $ticket, ?SupportTeam $team, ?StaffUser $actor = null): void
    {
        (new TicketConversationService)->assignTeam($ticket, $team?->id, $actor);
    }

    /**
     * Assign the ticket to the least-loaded available member of the team.
     * Returns the agent that received it, or null when nobody is available.
     */
    public function assignNextAvailable(Ticket $ticket, SupportTeam $team, ?StaffUser $actor = null): ?StaffUser
    {
        return DB::transaction(function () use ($ticket, $team, $actor) {
            $agent = $this->nextAvailable($team);

            $oldAgent = $ticket->assigned_agent_id;
            $ticket->forceFill([
                'assigned_team_id' => $team->id,
                'assigned_agent_id' => $agent?->id,
            ])->save();

            if ($ticket->status === 'new') {
                $ticket->forceFill(['status' => 'open'])->save();
            }

            (new TicketConversationService)->recordEvent(
                $ticket,
                $agent ? 'assigned' : 'team_assigned',
                $actor,
                $oldAgent ? (string) $oldAgent : null,
                $agent ? (string) $agent->id : (string) $team->id,
            );

            return $agent;
        });
    }

    /**
     * The least-loaded available member of a team (fewest open tickets),
     * preferring team leads when loads are equal.
     */
    public function nextAvailable(SupportTeam $team): ?StaffUser
    {
        $members = $team->members()
            ->where('is_active', true)
            ->where('is_available', true)
            ->lockForUpdate()
            ->get();

        if ($members->isEmpty()) {
            return null;
        }

        return $members
            ->map(fn (StaffUser $member) => (object) [
                'member' => $member,
                'load' => Ticket::query()
                    ->where('assigned_agent_id', $member->id)
                    ->whereNotIn('status', ['resolved', 'closed'])
                    ->count(),
                'lead' => (bool) $member->pivot->is_lead,
            ])
            ->sortBy(fn ($row) => [$row->load, $row->lead ? 0 : 1])
            ->first()
            ->member;
    }

    /**
     * Toggle an agent's availability for new assignments.
     */
    public function setAvailability(StaffUser $agent, bool $available): void
    {
        $agent->forceFill(['is_available' => $available])->save();
    }

    /**
     * Escalate a ticket within its team (status → escalated).
     */
    public function escalate(Ticket $ticket, ?StaffUser $actor = null): void
    {
        (new TicketConversationService)->escalate($ticket, $actor);
    }
}
