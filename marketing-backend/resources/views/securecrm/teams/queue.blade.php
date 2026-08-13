@extends('securecrm.layouts.app')

@section('title', $team->name.' queue')
@section('crumb', 'SecureCRM / Operations / Teams')
@section('heading', $team->name.' queue')

@section('content')
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-[#F0F5F8] px-3 py-1 text-[11px] font-bold text-[#667085]">{{ $tickets->total() }} open</span>
            <span class="rounded-full bg-[#F0F5F8] px-3 py-1 text-[11px] font-bold text-[#667085]">{{ $team->members_count }} member{{ $team->members_count === 1 ? '' : 's' }}</span>
            @if (! $team->is_active)
                <span class="rounded-full bg-[#F2D0D0] px-3 py-1 text-[11px] font-bold text-[#B42318]">disabled</span>
            @endif
        </div>
        <a href="{{ route('securecrm.teams') }}" class="text-[13px] font-semibold text-[#2164b6] hover:text-[#1b52a0]">← Back to teams</a>
    </div>

    <div class="mt-4 overflow-hidden rounded-2xl border border-[#D6E0E8] bg-white">
        <table class="w-full text-left">
            <thead>
                <tr class="border-b border-[#D6E0E8] bg-[#F7FAFC] text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">
                    <th class="px-5 py-3">Ticket</th>
                    <th class="px-5 py-3">Customer</th>
                    <th class="px-5 py-3">Priority</th>
                    <th class="px-5 py-3">Status</th>
                    <th class="px-5 py-3">SLA</th>
                    <th class="px-5 py-3">Agent</th>
                    <th class="px-5 py-3">Created</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-[#F0F5F8]">
                @php
                    $priorityStyles = [
                        'critical' => 'bg-[#DC2626]/10 text-[#DC2626]',
                        'urgent' => 'bg-[#EA580C]/10 text-[#EA580C]',
                        'high' => 'bg-[#F59E0B]/10 text-[#B45309]',
                        'normal' => 'bg-[#38A8D8]/10 text-[#2164b6]',
                        'low' => 'bg-[#98A2B3]/10 text-[#667085]',
                    ];
                    $statusStyles = [
                        'new' => 'bg-[#2164b6]/10 text-[#2164b6]',
                        'open' => 'bg-[#38A8D8]/10 text-[#1f7aa8]',
                        'pending_customer' => 'bg-[#F59E0B]/10 text-[#B45309]',
                        'pending_internal' => 'bg-[#F59E0B]/10 text-[#B45309]',
                        'escalated' => 'bg-[#DC2626]/10 text-[#DC2626]',
                        'reopened' => 'bg-[#EA580C]/10 text-[#EA580C]',
                    ];
                    $slaStyles = [
                        'remaining' => 'bg-[#2164b6]/10 text-[#2164b6]',
                        'paused' => 'bg-[#F59E0B]/10 text-[#B45309]',
                        'breached' => 'bg-[#DC2626]/10 text-[#DC2626]',
                        'completed' => 'bg-[#16A34A]/10 text-[#16A34A]',
                    ];
                @endphp
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
                            <span class="block max-w-40 truncate text-[11px] text-[#98A2B3]">{{ $ticket->user?->email ?? ($ticket->customer_email ?? '—') }}</span>
                        </td>
                        <td class="px-5 py-3.5">
                            <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $priorityStyles[$ticket->priority] ?? 'bg-[#F0F5F8] text-[#667085]' }}">{{ $ticket->priorityLabel() }}</span>
                        </td>
                        <td class="px-5 py-3.5">
                            <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $statusStyles[$ticket->status] ?? 'bg-[#F0F5F8] text-[#667085]' }}">{{ $ticket->statusLabel() }}</span>
                        </td>
                        <td class="px-5 py-3.5">
                            @if (isset($snapshots[$ticket->id]))
                                <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $slaStyles[$snapshots[$ticket->id]['status']] ?? 'bg-[#F0F5F8] text-[#667085]' }}">{{ ucfirst($snapshots[$ticket->id]['status']) }}</span>
                            @else
                                <span class="text-[12px] text-[#B7C6D1]">—</span>
                            @endif
                        </td>
                        <td class="px-5 py-3.5 text-[13px] text-[#667085]">{{ $ticket->assignedAgent?->name ?? 'Unassigned' }}</td>
                        <td class="px-5 py-3.5 text-[12px] text-[#98A2B3]">{{ $ticket->created_at->diffForHumans() }}</td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="7" class="px-5 py-14 text-center">
                            <p class="text-[14px] font-semibold text-[#667085]">Queue is clear</p>
                            <p class="mt-1 text-[12px] text-[#98A2B3]">No open tickets assigned to this team.</p>
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