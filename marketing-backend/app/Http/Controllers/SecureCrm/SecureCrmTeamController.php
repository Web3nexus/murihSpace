<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\StaffUser;
use App\Models\SupportTeam;
use App\Models\Ticket;
use App\Services\SlaService;
use App\Services\TeamService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class SecureCrmTeamController extends Controller
{
    public function __construct(
        protected TeamService $teams,
    ) {}

    public function index(): View
    {
        $teams = SupportTeam::query()
            ->withCount('members')
            ->withCount('openTickets')
            ->with(['members'])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $unassigned = Ticket::query()
            ->whereNull('assigned_team_id')
            ->whereNull('assigned_agent_id')
            ->whereNotIn('status', ['resolved', 'closed'])
            ->count();

        return view('securecrm.teams.index', [
            'teams' => $teams,
            'unassigned' => $unassigned,
            'agents' => StaffUser::query()->where('is_active', true)->orderBy('name')->get(),
            'routes' => [
                'store' => route('securecrm.teams.store'),
                'update' => fn (SupportTeam $team) => route('securecrm.teams.update', $team),
                'toggle' => fn (SupportTeam $team) => route('securecrm.teams.toggle', $team),
                'destroy' => fn (SupportTeam $team) => route('securecrm.teams.destroy', $team),
                'queue' => fn (SupportTeam $team) => route('securecrm.teams.queue', $team),
                'members' => fn (SupportTeam $team) => route('securecrm.teams.members', $team),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'member_ids' => ['nullable', 'array'],
            'member_ids.*' => ['integer', 'exists:staff_users,id'],
            'lead_ids' => ['nullable', 'array'],
            'lead_ids.*' => ['integer', 'exists:staff_users,id'],
        ]);

        $team = DB::transaction(function () use ($validated, $request) {
            $team = SupportTeam::create([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'is_active' => (bool) ($validated['is_active'] ?? true),
                'sort_order' => (int) ($validated['sort_order'] ?? 0),
                'created_by' => $request->user('staff')->id,
            ]);

            $this->syncMembers($team, $validated);

            return $team;
        });

        return redirect()->route('securecrm.teams')
            ->with('status', "Team \"{$team->name}\" created.");
    }

    public function update(Request $request, SupportTeam $team): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'member_ids' => ['nullable', 'array'],
            'member_ids.*' => ['integer', 'exists:staff_users,id'],
            'lead_ids' => ['nullable', 'array'],
            'lead_ids.*' => ['integer', 'exists:staff_users,id'],
        ]);

        DB::transaction(function () use ($team, $validated) {
            $team->update([
                'name' => $validated['name'],
                'description' => $validated['description'] ?? null,
                'is_active' => (bool) ($validated['is_active'] ?? true),
                'sort_order' => (int) ($validated['sort_order'] ?? 0),
            ]);

            $this->syncMembers($team, $validated);
        });

        return redirect()->route('securecrm.teams')
            ->with('status', "Team \"{$team->name}\" updated.");
    }

    public function toggle(Request $request, SupportTeam $team): RedirectResponse
    {
        $team->update(['is_active' => ! $team->is_active]);

        return back()->with(
            'status',
            $team->is_active ? "Team \"{$team->name}\" enabled." : "Team \"{$team->name}\" disabled.",
        );
    }

    public function destroy(Request $request, SupportTeam $team): RedirectResponse
    {
        $name = $team->name;
        $team->delete();

        return redirect()->route('securecrm.teams')
            ->with('status', "Team \"{$name}\" deleted.");
    }

    /**
     * The team's ticket queue (open tickets assigned to the team).
     */
    public function queue(Request $request, SupportTeam $team): View
    {
        $tickets = Ticket::query()
            ->with(['category', 'assignedAgent', 'user', 'slaPolicy'])
            ->team($team->id)
            ->whereNotIn('status', ['resolved', 'closed'])
            ->orderByRaw("case status when 'new' then 0 when 'escalated' then 1 when 'open' then 2 else 3 end")
            ->orderByDesc('created_at')
            ->paginate(25)
            ->withQueryString();

        $sla = new SlaService;
        $snapshots = $tickets->getCollection()
            ->mapWithKeys(fn (Ticket $ticket) => [$ticket->id => $sla->snapshot($ticket)]);

        return view('securecrm.teams.queue', [
            'team' => $team,
            'tickets' => $tickets,
            'snapshots' => $snapshots,
        ]);
    }

    /**
     * Manage a team's membership (members + leads) and agent availability.
     */
    public function members(Request $request, SupportTeam $team): RedirectResponse
    {
        $validated = $request->validate([
            'member_ids' => ['nullable', 'array'],
            'member_ids.*' => ['integer', 'exists:staff_users,id'],
            'lead_ids' => ['nullable', 'array'],
            'lead_ids.*' => ['integer', 'exists:staff_users,id'],
        ]);

        $this->syncMembers($team, $validated);

        return back()->with('status', "Team \"{$team->name}\" members updated.");
    }

    public function availability(Request $request, StaffUser $agent): RedirectResponse
    {
        $validated = $request->validate([
            'is_available' => ['required', 'boolean'],
        ]);

        $this->teams->setAvailability($agent, (bool) $validated['is_available']);

        return back()->with('status', $agent->is_available ? "{$agent->name} is now available." : "{$agent->name} is now unavailable.");
    }

    public function assignTicket(Request $request, Ticket $ticket): RedirectResponse
    {
        $validated = $request->validate([
            'assigned_team_id' => ['nullable', 'integer', 'exists:support_teams,id'],
            'auto_assign' => ['nullable', 'boolean'],
        ]);

        $teamId = $validated['assigned_team_id'] ?? null;
        $team = $teamId !== null ? SupportTeam::find($teamId) : null;

        if ($team && ($validated['auto_assign'] ?? false)) {
            $agent = $this->teams->assignNextAvailable($ticket, $team, $request->user('staff'));

            return back()->with(
                'status',
                $agent
                    ? "Ticket assigned to team \"{$team->name}\" → {$agent->name} (load-balanced)."
                    : "Ticket assigned to team \"{$team->name}\" — no available agent, queued.",
            );
        }

        $this->teams->assignTeam($ticket, $team, $request->user('staff'));

        return back()->with(
            'status',
            $team ? "Ticket assigned to team \"{$team->name}\"." : 'Ticket unassigned from team.',
        );
    }

    /**
     * Sync a team's member + lead pivot rows from a validated payload.
     */
    protected function syncMembers(SupportTeam $team, array $validated): void
    {
        $memberIds = array_map('intval', $validated['member_ids'] ?? []);
        $leadIds = array_map('intval', $validated['lead_ids'] ?? []);

        $team->members()->sync(collect($memberIds)->mapWithKeys(fn (int $id) => [
            $id => ['is_lead' => in_array($id, $leadIds, true)],
        ])->all());
    }
}
