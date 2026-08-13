<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\Macro;
use App\Models\StaffUser;
use App\Models\SupportTeam;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Services\MacroService;
use App\Services\SlaService;
use App\Services\TicketAutomationEngine;
use App\Services\TicketConversationService;
use App\Services\TicketNotifier;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class SecureCrmTicketController extends Controller
{
    public function __construct(
        protected TicketConversationService $conversation
    ) {}

    public function index(Request $request): View
    {
        $tickets = Ticket::query()
            ->with(['category', 'assignedAgent', 'user', 'slaPolicy', 'assignedTeam'])
            ->when($request->filled('status') && $request->query('status') !== 'all', fn ($q) => $q->status($request->query('status')))
            ->when($request->filled('priority') && $request->query('priority') !== 'all', fn ($q) => $q->priority($request->query('priority')))
            ->channel($request->filled('channel') && $request->query('channel') !== 'all' ? $request->query('channel') : null)
            ->assignedTo($request->filled('assigned') && $request->query('assigned') !== 'all' ? (int) $request->query('assigned') : null)
            ->team($request->filled('team') && $request->query('team') !== 'all' ? (int) $request->query('team') : null)
            ->when($request->query('team') === 'none', fn ($q) => $q->whereNull('assigned_team_id'))
            ->search($request->query('q'))
            ->orderByRaw("case status when 'new' then 0 when 'escalated' then 1 when 'open' then 2 else 3 end")
            ->orderByDesc('created_at')
            ->paginate(25)
            ->withQueryString();

        $sla = new SlaService;
        $snapshots = $tickets->getCollection()
            ->mapWithKeys(fn (Ticket $ticket) => [$ticket->id => $sla->snapshot($ticket)]);

        return view('securecrm.tickets.index', [
            'tickets' => $tickets,
            'snapshots' => $snapshots,
            'statuses' => Ticket::STATUSES,
            'priorities' => Ticket::PRIORITIES,
            'channels' => Ticket::CHANNELS,
            'teams' => SupportTeam::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
            'agents' => StaffUser::query()->where('is_active', true)->orderBy('name')->get(),
            'filters' => $request->query(),
            'counts' => [
                'all' => Ticket::query()->count(),
                'open' => Ticket::query()->open()->count(),
                'new' => Ticket::query()->status('new')->count(),
                'resolved' => Ticket::query()->status('resolved')->count(),
            ],
        ]);
    }

    public function create(): View
    {
        return view('securecrm.tickets.create', [
            'categories' => TicketCategory::query()->whereNull('parent_id')->with('children')->orderBy('sort_order')->get(),
            'priorities' => Ticket::PRIORITIES,
            'agents' => StaffUser::query()->where('is_active', true)->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:10000'],
            'category_id' => ['nullable', 'integer', 'exists:ticket_categories,id'],
            'priority' => ['required', 'in:'.implode(',', Ticket::PRIORITIES)],
            'assigned_agent_id' => ['nullable', 'integer', 'exists:staff_users,id'],
        ]);

        $ticket = DB::transaction(function () use ($validated, $request) {
            $ticket = Ticket::create([
                'ticket_number' => Ticket::generateTicketNumber(),
                'subject' => $validated['subject'],
                'description' => $validated['description'],
                'category_id' => $validated['category_id'] ?? null,
                'priority' => $validated['priority'],
                'status' => $validated['assigned_agent_id'] ?? null ? 'open' : 'new',
                'channel' => 'staff_created',
                'assigned_agent_id' => $validated['assigned_agent_id'] ?? null,
                'created_by' => $request->user('staff')->id,
            ]);

            (new TicketAutomationEngine)->apply($ticket, 'created');
            (new SlaService)->assignPolicy($ticket);

            return $ticket;
        });

        app(TicketNotifier::class)->ticketCreated($ticket);

        return redirect()->route('securecrm.tickets.show', $ticket)
            ->with('status', "Ticket {$ticket->ticket_number} created.");
    }

    public function show(Ticket $ticket): View
    {
        $ticket->load([
            'category', 'assignedAgent', 'assignedTeam', 'createdBy', 'user', 'slaPolicy',
            'messages.attachments', 'messages.staffUser',
            'events.staffUser', 'attachments', 'tags',
        ]);

        return view('securecrm.tickets.show', [
            'ticket' => $ticket,
            'sla' => (new SlaService)->snapshot($ticket),
            'macros' => Macro::query()->where('is_active', true)->orderBy('category')->orderBy('name')->get(),
            'statuses' => Ticket::STATUSES,
            'agents' => StaffUser::query()->where('is_active', true)->orderBy('name')->get(),
            'teams' => SupportTeam::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name')->get(),
        ]);
    }

    public function reply(Ticket $ticket, Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
        ]);

        $this->conversation->addMessage(
            $ticket,
            'reply',
            $validated['body'],
            $request->user('staff'),
        );

        if ($ticket->status === 'new') {
            $this->conversation->changeStatus($ticket, 'open', $request->user('staff'));
        }

        return back()->with('status', 'Reply sent to the customer.');
    }

    public function note(Ticket $ticket, Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
        ]);

        $message = $this->conversation->addMessage(
            $ticket,
            'internal_note',
            $validated['body'],
            $request->user('staff'),
            ['note' => true],
        );

        $this->conversation->recordEvent($ticket, 'note_added', $request->user('staff'));

        return back()->with('status', 'Internal note added.');
    }

    public function status(Ticket $ticket, Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:'.implode(',', Ticket::STATUSES)],
        ]);

        $this->conversation->changeStatus($ticket, $validated['status'], $request->user('staff'));

        return back()->with('status', "Ticket marked as {$validated['status']}.");
    }

    public function assign(Ticket $ticket, Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'assigned_agent_id' => ['nullable', 'integer', 'exists:staff_users,id'],
        ]);

        $agent = $validated['assigned_agent_id'] ? StaffUser::find($validated['assigned_agent_id']) : null;

        $this->conversation->assign($ticket, $agent, $request->user('staff'));

        return back()->with('status', $agent ? "Ticket assigned to {$agent->name}." : 'Ticket unassigned.');
    }

    public function escalate(Ticket $ticket, Request $request): RedirectResponse
    {
        $this->conversation->escalate($ticket, $request->user('staff'));

        return back()->with('status', 'Ticket escalated.');
    }

    public function applyMacro(Ticket $ticket, Macro $macro, Request $request): RedirectResponse
    {
        if (! $macro->is_active) {
            abort(404);
        }

        try {
            $applied = (new MacroService)->apply($macro, $ticket, $request->user('staff'));
        } catch (AuthorizationException $e) {
            abort(403, $e->getMessage());
        }

        $summary = $applied === [] ? 'nothing to change' : implode(', ', $applied);

        return back()->with('status', "Macro \"{$macro->name}\" applied ({$summary}).");
    }
}
