@extends('securecrm.layouts.app')

@section('title', 'Tickets')
@section('crumb', 'SecureCRM / Support')
@section('heading', 'Tickets')

@section('content')
    <div class="flex flex-wrap items-end justify-between gap-4">
        <div class="flex flex-wrap items-center gap-2">
            <a href="{{ route('securecrm.tickets', ['status' => 'all']) }}"
               class="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors {{ ($filters['status'] ?? 'all') === 'all' ? 'bg-[#102840] text-white' : 'border border-[#D6E0E8] bg-white text-[#667085] hover:border-[#38A8D8]/50 hover:text-[#2164b6]' }}">
                All ({{ $counts['all'] }})
            </a>
            <a href="{{ route('securecrm.tickets', ['status' => 'new']) }}"
               class="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors {{ ($filters['status'] ?? 'all') === 'new' ? 'bg-[#102840] text-white' : 'border border-[#D6E0E8] bg-white text-[#667085] hover:border-[#38A8D8]/50 hover:text-[#2164b6]' }}">
                New ({{ $counts['new'] }})
            </a>
            <a href="{{ route('securecrm.tickets', ['status' => 'resolved']) }}"
               class="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors {{ ($filters['status'] ?? 'all') === 'resolved' ? 'bg-[#102840] text-white' : 'border border-[#D6E0E8] bg-white text-[#667085] hover:border-[#38A8D8]/50 hover:text-[#2164b6]' }}">
                Resolved ({{ $counts['resolved'] }})
            </a>
        </div>
        <a href="{{ route('securecrm.tickets.create') }}"
           class="inline-flex items-center gap-2 rounded-lg bg-[#2164b6] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="M5 12h14M12 5v14"/></svg>
            New ticket
        </a>
    </div>

    <!-- Filters -->
    <form method="GET" action="{{ route('securecrm.tickets') }}" class="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[#D6E0E8] bg-white p-4">
        <div class="min-w-40 flex-1">
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Search</label>
            <input type="search" name="q" value="{{ $filters['q'] ?? '' }}" placeholder="Number, subject, email…"
                   class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
        </div>
        <div class="min-w-32">
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Priority</label>
            <select name="priority" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                <option value="all">All</option>
                @foreach ($priorities as $priority)
                    <option value="{{ $priority }}" @selected(($filters['priority'] ?? '') === $priority)>{{ ucfirst($priority) }}</option>
                @endforeach
            </select>
        </div>
        <div class="min-w-32">
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Channel</label>
            <select name="channel" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                <option value="">All</option>
                @foreach ($channels as $channel)
                    <option value="{{ $channel }}" @selected(($filters['channel'] ?? '') === $channel)>{{ str_replace('_', ' ', ucfirst($channel)) }}</option>
                @endforeach
            </select>
        </div>
        <div class="min-w-32">
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Assigned</label>
            <select name="assigned" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                <option value="all">Anyone</option>
                @foreach ($agents as $agent)
                    <option value="{{ $agent->id }}" @selected(($filters['assigned'] ?? '') === (string) $agent->id)>{{ $agent->name }}</option>
                @endforeach
            </select>
        </div>
        <div class="min-w-32">
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Team</label>
            <select name="team" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                <option value="all">Any team</option>
                <option value="none" @selected(($filters['team'] ?? '') === 'none')>Unassigned</option>
                @foreach ($teams ?? [] as $team)
                    <option value="{{ $team->id }}" @selected(($filters['team'] ?? '') === (string) $team->id)>{{ $team->name }}</option>
                @endforeach
            </select>
        </div>
        <button type="submit" class="rounded-lg border border-[#D6E0E8] bg-[#F7FAFC] px-4 py-2 text-[13px] font-semibold text-[#102840] transition-colors hover:border-[#38A8D8]/50 hover:text-[#2164b6]">
            Apply filters
        </button>
    </form>

    <!-- Ticket table -->
    <div class="mt-5 overflow-hidden rounded-2xl border border-[#D6E0E8] bg-white">
        <table class="w-full text-left">
            <thead>
                <tr class="border-b border-[#D6E0E8] bg-[#F7FAFC] text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">
                    <th class="px-5 py-3">Ticket</th>
                    <th class="px-5 py-3">Customer</th>
                    <th class="px-5 py-3">Category</th>
                    <th class="px-5 py-3">Priority</th>
                    <th class="px-5 py-3">Status</th>
                    <th class="px-5 py-3">SLA</th>
                    <th class="px-5 py-3">Assigned</th>
                    <th class="px-5 py-3">Created</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-[#F0F5F8]">
                @forelse ($tickets as $ticket)
                    <tr class="transition-colors hover:bg-[#F7FAFC]">
                        <td class="px-5 py-3.5">
                            <a href="{{ route('securecrm.tickets.show', $ticket) }}" class="block">
                                <span class="font-mono text-[12px] font-semibold text-[#2164b6]">{{ $ticket->ticket_number }}</span>
                                <span class="mt-0.5 block max-w-60 truncate text-[13px] font-semibold text-[#102840]">{{ $ticket->subject }}</span>
                            </a>
                        </td>
                        <td class="px-5 py-3.5">
                            <span class="block max-w-40 truncate text-[13px] text-[#667085]">{{ $ticket->user?->name ?? 'Public' }}</span>
                            <span class="block max-w-40 truncate text-[11px] text-[#98A2B3]">{{ $ticket->user?->email ?? '—' }}</span>
                        </td>
                        <td class="px-5 py-3.5 text-[13px] text-[#667085]">{{ $ticket->category?->name ?? '—' }}</td>
                        <td class="px-5 py-3.5">
                            @php
                                $priorityStyles = [
                                    'critical' => 'bg-[#DC2626]/10 text-[#DC2626]',
                                    'urgent' => 'bg-[#EA580C]/10 text-[#EA580C]',
                                    'high' => 'bg-[#F59E0B]/10 text-[#B45309]',
                                    'normal' => 'bg-[#38A8D8]/10 text-[#2164b6]',
                                    'low' => 'bg-[#98A2B3]/10 text-[#667085]',
                                ];
                            @endphp
                            <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $priorityStyles[$ticket->priority] ?? 'bg-[#F0F5F8] text-[#667085]' }}">{{ $ticket->priorityLabel() }}</span>
                        </td>
                        <td class="px-5 py-3.5">
                            @php
                                $statusStyles = [
                                    'new' => 'bg-[#2164b6]/10 text-[#2164b6]',
                                    'open' => 'bg-[#38A8D8]/10 text-[#1f7aa8]',
                                    'pending_customer' => 'bg-[#F59E0B]/10 text-[#B45309]',
                                    'pending_internal' => 'bg-[#F59E0B]/10 text-[#B45309]',
                                    'escalated' => 'bg-[#DC2626]/10 text-[#DC2626]',
                                    'resolved' => 'bg-[#16A34A]/10 text-[#16A34A]',
                                    'closed' => 'bg-[#98A2B3]/10 text-[#667085]',
                                    'reopened' => 'bg-[#EA580C]/10 text-[#EA580C]',
                                ];
                            @endphp
                            <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $statusStyles[$ticket->status] ?? 'bg-[#F0F5F8] text-[#667085]' }}">{{ $ticket->statusLabel() }}</span>
                        </td>
                        <td class="px-5 py-3.5">
                            @php
                                $sla = $snapshots[$ticket->id] ?? null;
                                $slaStyles = [
                                    'remaining' => 'bg-[#2164b6]/10 text-[#2164b6]',
                                    'paused' => 'bg-[#F59E0B]/10 text-[#B45309]',
                                    'breached' => 'bg-[#DC2626]/10 text-[#DC2626]',
                                    'completed' => 'bg-[#16A34A]/10 text-[#16A34A]',
                                ];
                            @endphp
                            @if ($sla)
                                <a href="{{ route('securecrm.tickets.show', $ticket) }}#sla" class="group flex items-center gap-2">
                                    <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $slaStyles[$sla['status']] ?? 'bg-[#F0F5F8] text-[#667085]' }}">
                                        {{ ucfirst($sla['status']) }}
                                    </span>
                                    @if ($sla['status'] !== 'completed')
                                        @php
                                            $leave = $sla['resolution']['remaining'];
                                            $leaveLabel = $leave >= 86400
                                                ? round($leave / 86400).'d'
                                                : ($leave >= 3600 ? round($leave / 3600).'h' : ceil($leave / 60).'m');
                                        @endphp
                                        <span class="text-[11px] text-[#98A2B3] group-hover:text-[#2164b6]">{{ $leaveLabel }}</span>
                                    @endif
                                </a>
                            @else
                                <span class="text-[12px] text-[#B7C6D1]">—</span>
                            @endif
                        </td>
                        <td class="px-5 py-3.5 text-[13px] text-[#667085]">
                            @if ($ticket->assignedAgent)
                                {{ $ticket->assignedAgent->name }}
                            @elseif ($ticket->assignedTeam)
                                <span class="font-semibold text-[#2164b6]">{{ $ticket->assignedTeam->name }}</span>
                            @else
                                —
                            @endif
                        </td>
                        <td class="px-5 py-3.5 text-[12px] text-[#98A2B3]">{{ $ticket->created_at->diffForHumans() }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="8" class="px-5 py-14 text-center">
                            <p class="text-[14px] font-semibold text-[#667085]">No tickets found</p>
                            <p class="mt-1 text-[12px] text-[#98A2B3]">Try adjusting the filters, or create a new ticket.</p>
                        </td>
                    </tr>
                @endforelse
            </tbody>
        </table>

        <div class="border-t border-[#D6E0E8] px-5 py-3">
            {{ $tickets->links() }}
        </div>
    </div>
@endsection
