@extends('securecrm.layouts.app')

@section('title', 'Audit Logs')
@section('crumb', 'SecureCRM / Operations')
@section('heading', 'Audit Logs')

@php
    $badgeColors = [
        'staff' => 'bg-[#102840]/5 text-[#102840]',
        'ticket' => 'bg-[#2164b6]/10 text-[#2164b6]',
        'customer' => 'bg-[#7C3AED]/10 text-[#7C3AED]',
        'kyc' => 'bg-[#B42318]/10 text-[#B42318]',
        'help' => 'bg-[#03838F]/10 text-[#03838F]',
        'cms' => 'bg-[#15803D]/10 text-[#15803D]',
        'sla' => 'bg-[#D97706]/10 text-[#D97706]',
        'refund' => 'bg-[#DC2626]/10 text-[#DC2626]',
    ];
@endphp

@section('content')
    <p class="mb-5 text-[13px] text-[#667085]">
        An immutable record of sensitive staff actions. Entries are written automatically and cannot be edited or deleted.
    </p>

    <!-- Filters -->
    <form method="GET" action="{{ route('securecrm.audit') }}" class="mt-2 flex flex-wrap items-end gap-3 rounded-2xl border border-[#D6E0E8] bg-white p-4">
        <div class="min-w-48 flex-1">
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Search</label>
            <input type="search" name="q" value="{{ $filters['q'] ?? '' }}" placeholder="Action, subject, agent…"
                   class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
        </div>
        <div class="min-w-44">
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Action</label>
            <select name="action" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                <option value="">All actions</option>
                @foreach ($groups as $group => $actions)
                    <optgroup label="{{ ucfirst($group) }}">
                        @foreach ($actions as $key => $label)
                            <option value="{{ $key }}" @selected(($filters['action'] ?? '') === $key)>{{ $label }}</option>
                        @endforeach
                    </optgroup>
                @endforeach
            </select>
        </div>
        <div class="min-w-44">
            <label class="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Agent</label>
            <select name="actor" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                <option value="">All agents</option>
                @foreach ($actors as $actor)
                    <option value="{{ $actor->id }}" @selected(($filters['actor'] ?? '') === (string) $actor->id)>{{ $actor->name }}</option>
                @endforeach
            </select>
        </div>
        <button type="submit" class="rounded-lg border border-[#D6E0E8] bg-[#F7FAFC] px-4 py-2 text-[13px] font-semibold text-[#102840] transition-colors hover:border-[#38A8D8]/50 hover:text-[#2164b6]">
            Apply filters
        </button>
        @if (array_filter($filters))
            <a href="{{ route('securecrm.audit') }}" class="rounded-lg px-3 py-2 text-[13px] font-semibold text-[#2164b6] hover:text-[#1b52a0]">Clear</a>
        @endif
    </form>

    <!-- Audit table -->
    <div class="mt-5 overflow-hidden rounded-2xl border border-[#D6E0E8] bg-white">
        <div class="overflow-x-auto">
            <table class="w-full min-w-[900px] text-left text-[13px]">
                <thead class="border-b border-[#F0F4F8] bg-[#F7FAFC] text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">
                    <tr>
                        <th class="px-5 py-3">When</th>
                        <th class="px-5 py-3">Agent</th>
                        <th class="px-5 py-3">Action</th>
                        <th class="px-5 py-3">Subject</th>
                        <th class="px-5 py-3">Changes</th>
                        <th class="px-5 py-3">Location</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-[#F0F4F8]">
                    @forelse ($logs as $log)
                        @php
                            $changes = $log->changes();
                            $group = $log->group();
                        @endphp
                        <tr class="align-top hover:bg-[#F7FAFC]/60">
                            <td class="whitespace-nowrap px-5 py-3.5">
                                <p class="font-semibold text-[#102840]">{{ $log->created_at->format('M j, Y') }}</p>
                                <p class="text-[11px] text-[#98A2B3]">{{ $log->created_at->format('H:i:s') }}</p>
                            </td>
                            <td class="whitespace-nowrap px-5 py-3.5">
                                @if ($log->staffUser)
                                    <p class="font-semibold text-[#102840]">{{ $log->staffUser->name }}</p>
                                    <p class="text-[11px] text-[#98A2B3]">{{ $log->staffUser->role }}</p>
                                @else
                                    <span class="text-[#98A2B3]">System</span>
                                @endif
                            </td>
                            <td class="whitespace-nowrap px-5 py-3.5">
                                <span class="rounded-full px-2.5 py-1 text-[11px] font-semibold {{ $badgeColors[$group] ?? 'bg-[#F0F4F8] text-[#667085]' }}">
                                    {{ $log->actionLabel() }}
                                </span>
                            </td>
                            <td class="max-w-48 px-5 py-3.5">
                                @if ($log->subject_reference)
                                    <p class="truncate font-semibold text-[#102840]" title="{{ $log->subject_reference }}">{{ $log->subject_reference }}</p>
                                @elseif ($log->subject_id)
                                    <p class="font-semibold text-[#102840]">#{{ $log->subject_id }}</p>
                                @else
                                    <span class="text-[#98A2B3]">—</span>
                                @endif
                            </td>
                            <td class="max-w-64 px-5 py-3.5">
                                @forelse ($changes as $change)
                                    <div class="mb-1 flex items-center gap-1.5 text-[12px] last:mb-0">
                                        <span class="font-semibold text-[#667085]">{{ $change['field'] }}:</span>
                                        <span class="rounded bg-[#F0F4F8] px-1.5 py-0.5 text-[#98A2B3] line-through">{{ Str::limit((string) $change['before'], 24) }}</span>
                                        <span>→</span>
                                        <span class="rounded bg-[#15803D]/10 px-1.5 py-0.5 font-semibold text-[#15803D]">{{ Str::limit((string) $change['after'], 24) }}</span>
                                    </div>
                                @empty
                                    <span class="text-[#98A2B3]">—</span>
                                @endforelse
                            </td>
                            <td class="whitespace-nowrap px-5 py-3.5">
                                @if ($log->ip_address)
                                    <p class="font-mono text-[12px] text-[#667085]">{{ $log->ip_address }}</p>
                                @endif
                                <p class="max-w-40 truncate text-[11px] text-[#98A2B3]" title="{{ $log->user_agent }}">{{ $log->user_agent ?: '—' }}</p>
                            </td>
                        </tr>
                    @empty
                        <tr>
                            <td colspan="6" class="px-5 py-12 text-center">
                                <p class="text-[13px] font-semibold text-[#667085]">No audit entries found.</p>
                                <p class="mt-1 text-[12px] text-[#98A2B3]">Sensitive actions you perform will appear here.</p>
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
        <div class="border-t border-[#D6E0E8] px-5 py-3">
            {{ $logs->links() }}
        </div>
    </div>
@endsection