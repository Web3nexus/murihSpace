<?php

namespace App\Services;

use App\Models\HelpArticle;
use App\Models\HelpArticleFeedback;
use App\Models\HelpSearchTerm;
use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketEvent;

/**
 * Computes the SecureCRM Reports dashboard metrics from the local support
 * database. All figures are derived live at request time so the dashboard
 * always reflects the current state; nothing is materialised or cached.
 */
class SupportAnalyticsService
{
    /**
     * Full dashboard snapshot.
     *
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        return [
            'tickets' => [
                'open' => $this->openTickets(),
                'new_today' => $this->newTicketsToday(),
                'unassigned' => $this->unassignedTickets(),
                'critical' => $this->criticalTickets(),
                'avg_first_response_min' => $this->averageFirstResponseMinutes(),
                'avg_resolution_min' => $this->averageResolutionMinutes(),
                'sla_breaches' => $this->slaBreaches(),
                'reopened' => $this->reopenedTickets(),
                'by_category' => $this->ticketsByCategory(),
                'by_priority' => $this->ticketsByPriority(),
                'by_channel' => $this->ticketsByChannel(),
                'satisfaction' => $this->customerSatisfaction(),
                'agent_workload' => $this->agentWorkload(),
            ],
            'help' => [
                'article_views' => (int) HelpArticle::query()->sum('view_count'),
                'searches' => (int) HelpSearchTerm::query()->count(),
                'zero_result_searches' => $this->zeroResultSearches(),
                'article_helpfulness' => $this->articleHelpfulness(),
            ],
        ];
    }

    public function openTickets(): int
    {
        return (int) Ticket::query()->open()->count();
    }

    public function newTicketsToday(): int
    {
        return (int) Ticket::query()
            ->whereDate('created_at', today())
            ->count();
    }

    public function unassignedTickets(): int
    {
        return (int) Ticket::query()
            ->open()
            ->whereNull('assigned_agent_id')
            ->whereNull('assigned_team_id')
            ->count();
    }

    public function criticalTickets(): int
    {
        return (int) Ticket::query()
            ->open()
            ->where('priority', 'critical')
            ->count();
    }

    /**
     * Average minutes between ticket creation and the first agent reply,
     * across tickets that have one. Null when none have replied yet.
     *
     * Computed in PHP so the metrics work identically on Postgres and the
     * SQLite test database.
     */
    public function averageFirstResponseMinutes(): ?int
    {
        $pairs = Ticket::query()
            ->whereNotNull('first_response_at')
            ->get(['created_at', 'first_response_at']);

        if ($pairs->isEmpty()) {
            return null;
        }

        $totalSeconds = $pairs->sum(
            fn (Ticket $ticket) => $ticket->first_response_at->diffInSeconds($ticket->created_at)
        );

        return (int) round($totalSeconds / $pairs->count() / 60);
    }

    /**
     * Average minutes between ticket creation and resolution/closure, across
     * resolved or closed tickets. Null when none are resolved/closed.
     */
    public function averageResolutionMinutes(): ?int
    {
        $pairs = Ticket::query()
            ->whereIn('status', ['resolved', 'closed'])
            ->whereNotNull('resolved_at')
            ->get(['created_at', 'resolved_at']);

        if ($pairs->isEmpty()) {
            return null;
        }

        $totalSeconds = $pairs->sum(
            fn (Ticket $ticket) => $ticket->resolved_at->diffInSeconds($ticket->created_at)
        );

        return (int) round($totalSeconds / $pairs->count() / 60);
    }

    /**
     * Number of open tickets whose SLA snapshot is currently breached.
     */
    public function slaBreaches(): int
    {
        $sla = new SlaService;
        $count = 0;

        Ticket::query()
            ->open()
            ->whereNotNull('sla_policy_id')
            ->with('slaPolicy')
            ->chunk(100, function ($tickets) use ($sla, &$count) {
                foreach ($tickets as $ticket) {
                    $snapshot = $sla->snapshot($ticket);
                    if ($snapshot !== null && $snapshot['status'] === 'breached') {
                        $count++;
                    }
                }
            });

        return $count;
    }

    public function reopenedTickets(): int
    {
        return (int) TicketEvent::query()
            ->where('event', 'status_changed')
            ->where('new_value', 'reopened')
            ->distinct('ticket_id')
            ->count('ticket_id');
    }

    /**
     * @return array<int, array{name: string, count: int}>
     */
    public function ticketsByCategory(): array
    {
        return Ticket::query()
            ->leftJoin('ticket_categories', 'ticket_categories.id', '=', 'tickets.category_id')
            ->selectRaw('COALESCE(ticket_categories.name, \'Uncategorized\') as name')
            ->selectRaw('count(*) as total')
            ->groupBy('ticket_categories.name')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => ['name' => $row->name, 'count' => (int) $row->total])
            ->values()
            ->all();
    }

    /**
     * Volume by priority (the "by role" breakdown is not available locally —
     * tickets carry only customer_email/user_id — so reports group the queue
     * by priority instead).
     *
     * @return array<int, array{key: string, label: string, count: int}>
     */
    public function ticketsByPriority(): array
    {
        $counts = Ticket::query()
            ->selectRaw('priority, count(*) as total')
            ->groupBy('priority')
            ->orderByDesc('total')
            ->pluck('total', 'priority')
            ->all();

        return collect(Ticket::PRIORITIES)
            ->map(fn (string $priority) => [
                'key' => $priority,
                'label' => ucfirst($priority),
                'count' => (int) ($counts[$priority] ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, array{key: string, label: string, count: int}>
     */
    public function ticketsByChannel(): array
    {
        $counts = Ticket::query()
            ->selectRaw('channel, count(*) as total')
            ->groupBy('channel')
            ->orderByDesc('total')
            ->pluck('total', 'channel')
            ->all();

        return collect(Ticket::CHANNELS)
            ->map(fn (string $channel) => [
                'key' => $channel,
                'label' => str_replace('_', ' ', ucfirst($channel)),
                'count' => (int) ($counts[$channel] ?? 0),
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function customerSatisfaction(): array
    {
        $stats = Ticket::query()
            ->whereNotNull('rating')
            ->selectRaw('count(*) as count')
            ->selectRaw('avg(rating) as average')
            ->selectRaw('sum(case when rating = 5 then 1 else 0 end) as five')
            ->selectRaw('sum(case when rating = 4 then 1 else 0 end) as four')
            ->selectRaw('sum(case when rating = 3 then 1 else 0 end) as three')
            ->selectRaw('sum(case when rating = 2 then 1 else 0 end) as two')
            ->selectRaw('sum(case when rating = 1 then 1 else 0 end) as one')
            ->first();

        $count = (int) $stats?->count;

        return [
            'count' => $count,
            'average' => $count > 0 ? round((float) $stats->average, 2) : null,
            'distribution' => [
                '5' => (int) ($stats?->five ?? 0),
                '4' => (int) ($stats?->four ?? 0),
                '3' => (int) ($stats?->three ?? 0),
                '2' => (int) ($stats?->two ?? 0),
                '1' => (int) ($stats?->one ?? 0),
            ],
        ];
    }

    /**
     * Open ticket load per active agent, most-loaded first.
     *
     * @return array<int, array{agent: array<string, mixed>|null, name: string, open: int}>
     */
    public function agentWorkload(): array
    {
        $loads = Ticket::query()
            ->open()
            ->whereNotNull('assigned_agent_id')
            ->selectRaw('assigned_agent_id, count(*) as total')
            ->groupBy('assigned_agent_id')
            ->orderByDesc('total')
            ->get();

        $agents = StaffUser::query()
            ->where('is_active', true)
            ->get()
            ->keyBy('id');

        return $loads
            ->filter(fn ($row) => $agents->has($row->assigned_agent_id))
            ->map(function ($row) use ($agents) {
                $agent = $agents->get($row->assigned_agent_id);

                return [
                    'agent' => $agent,
                    'name' => $agent->name,
                    'open' => (int) $row->total,
                ];
            })
            ->values()
            ->all();
    }

    public function zeroResultSearches(): int
    {
        return (int) HelpSearchTerm::query()
            ->where('result_count', 0)
            ->count();
    }

    /**
     * @return array{helpful: int, total: int, rate: int}
     */
    public function articleHelpfulness(): array
    {
        $feedback = HelpArticleFeedback::query()
            ->selectRaw('count(*) as total')
            ->selectRaw('sum(case when helpful then 1 else 0 end) as helpful')
            ->first();

        $total = (int) ($feedback?->total ?? 0);

        return [
            'helpful' => (int) ($feedback?->helpful ?? 0),
            'total' => $total,
            'rate' => $total > 0 ? (int) round(((int) ($feedback?->helpful ?? 0) / $total) * 100) : 0,
        ];
    }
}
