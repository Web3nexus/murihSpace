@extends('securecrm.layouts.app')

@section('title', 'Reports')
@section('crumb', 'SecureCRM / Operations')
@section('heading', 'Reports')

@php
    $t = $metrics['tickets'];
    $h = $metrics['help'];

    $cards = [
        ['label' => 'Open tickets', 'value' => number_format($t['open']), 'icon' => 'tickets'],
        ['label' => 'New today', 'value' => number_format($t['new_today']), 'icon' => 'spark'],
        ['label' => 'Unassigned', 'value' => number_format($t['unassigned']), 'icon' => 'users'],
        ['label' => 'Critical', 'value' => number_format($t['critical']), 'icon' => 'alert'],
        ['label' => 'SLA breaches', 'value' => number_format($t['sla_breaches']), 'icon' => 'clock'],
        ['label' => 'Reopened', 'value' => number_format($t['reopened']), 'icon' => 'reopen'],
    ];

    $icons = [
        'tickets' => '<path d="M4 4h16v16H4Z"/><line x1="8" x2="20" y1="9" y2="9"/><line x1="8" x2="20" y1="15" y2="15"/><line x1="8" x2="20" y1="18" y2="18"/>',
        'spark' => '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>',
        'users' => '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        'alert' => '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        'clock' => '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
        'reopen' => '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    ];
@endphp

@section('content')
    <p class="mb-5 text-[13px] text-[#667085]">
        Live support performance snapshot. Figures are computed from current ticket, SLA, rating and help activity data.
    </p>

    <!-- Ticket KPI cards -->
    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        @foreach ($cards as $card)
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-4">
                <div class="flex items-center gap-3">
                    <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#102840]/5 text-[#2164b6]">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4.5">{!! $icons[$card['icon']] !!}</svg>
                    </span>
                    <div>
                        <p class="text-xl font-bold leading-none tracking-tight text-[#102840]">{{ $card['value'] }}</p>
                        <p class="mt-1 text-[11px] font-semibold text-[#667085]">{{ $card['label'] }}</p>
                    </div>
                </div>
            </div>
        @endforeach
    </div>

    <!-- Averages -->
    <div class="mt-5 grid gap-4 sm:grid-cols-2">
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <p class="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">Average first response</p>
            <p class="mt-1 text-2xl font-bold text-[#102840]">
                @if ($t['avg_first_response_min'] === null)
                    —
                @else
                    {{ number_format($t['avg_first_response_min']) }}
                    <span class="text-[13px] font-semibold text-[#98A2B3]">min</span>
                @endif
            </p>
        </div>
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <p class="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">Average resolution time</p>
            <p class="mt-1 text-2xl font-bold text-[#102840]">
                @if ($t['avg_resolution_min'] === null)
                    —
                @else
                    {{ number_format($t['avg_resolution_min']) }}
                    <span class="text-[13px] font-semibold text-[#98A2B3]">min</span>
                @endif
            </p>
        </div>
    </div>

    <!-- Distribution blocks -->
    <div class="mt-5 grid gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <p class="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">Tickets by priority</p>
            <div class="mt-3 space-y-2.5">
                @foreach ($t['by_priority'] as $row)
                    @php
                        $max = max(1, collect($t['by_priority'])->max('count'));
                        $pct = (int) round(($row['count'] / $max) * 100);
                    @endphp
                    <div class="flex items-center gap-3">
                        <span class="w-20 shrink-0 text-[12px] font-semibold text-[#102840]">{{ $row['label'] }}</span>
                        <div class="h-2 flex-1 overflow-hidden rounded-full bg-[#F0F4F8]">
                            <div class="h-full rounded-full bg-[#38A8D8]" style="width: {{ $pct }}%"></div>
                        </div>
                        <span class="w-8 shrink-0 text-right text-[12px] font-bold text-[#667085]">{{ $row['count'] }}</span>
                    </div>
                @endforeach
            </div>
        </div>

        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <p class="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">Tickets by channel</p>
            <div class="mt-3 space-y-2.5">
                @foreach ($t['by_channel'] as $row)
                    @php
                        $max = max(1, collect($t['by_channel'])->max('count'));
                        $pct = (int) round(($row['count'] / $max) * 100);
                    @endphp
                    <div class="flex items-center gap-3">
                        <span class="w-32 shrink-0 truncate text-[12px] font-semibold text-[#102840]">{{ $row['label'] }}</span>
                        <div class="h-2 flex-1 overflow-hidden rounded-full bg-[#F0F4F8]">
                            <div class="h-full rounded-full bg-[#2164b6]" style="width: {{ $pct }}%"></div>
                        </div>
                        <span class="w-8 shrink-0 text-right text-[12px] font-bold text-[#667085]">{{ $row['count'] }}</span>
                    </div>
                @endforeach
            </div>
        </div>
    </div>

    <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <p class="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">Tickets by category</p>
            <div class="mt-3 space-y-2.5">
                @forelse ($t['by_category'] as $row)
                    @php
                        $max = max(1, collect($t['by_category'])->max('count'));
                        $pct = (int) round(($row['count'] / $max) * 100);
                    @endphp
                    <div class="flex items-center gap-3">
                        <span class="w-40 shrink-0 truncate text-[12px] font-semibold text-[#102840]" title="{{ $row['name'] }}">{{ $row['name'] }}</span>
                        <div class="h-2 flex-1 overflow-hidden rounded-full bg-[#F0F4F8]">
                            <div class="h-full rounded-full bg-[#7C3AED]" style="width: {{ $pct }}%"></div>
                        </div>
                        <span class="w-8 shrink-0 text-right text-[12px] font-bold text-[#667085]">{{ $row['count'] }}</span>
                    </div>
                @empty
                    <p class="py-2 text-[12px] text-[#98A2B3]">No tickets yet.</p>
                @endforelse
            </div>
        </div>

        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <p class="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">Customer satisfaction</p>
            <div class="mt-2 flex items-center gap-3">
                <p class="text-4xl font-bold text-[#102840]">{{ $t['satisfaction']['average'] ?? '—' }}</p>
                <div>
                    <p class="text-[13px] font-semibold text-[#102840]">
                        {{ number_format($t['satisfaction']['count']) }} rated
                    </p>
                    <p class="text-[11px] text-[#98A2B3]">out of 5</p>
                </div>
            </div>
            <div class="mt-3 space-y-1">
                @foreach ([5, 4, 3, 2, 1] as $star)
                    @php
                        $total = max(1, $t['satisfaction']['count']);
                        $starCount = $t['satisfaction']['distribution'][(string) $star] ?? 0;
                        $pct = (int) round(($starCount / $total) * 100);
                    @endphp
                    <div class="flex items-center gap-3">
                        <span class="w-4 shrink-0 text-[12px] font-bold text-[#102840]">{{ $star }}</span>
                        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F0F4F8]">
                            <div class="h-full rounded-full {{ $star >= 4 ? 'bg-[#16A34A]' : 'bg-[#F5B94E]' }}" style="width: {{ $pct }}%"></div>
                        </div>
                        <span class="w-6 shrink-0 text-right text-[11px] font-semibold text-[#667085]">{{ $starCount }}</span>
                    </div>
                @endforeach
            </div>
        </div>
    </div>

    <!-- Agent workload -->
    <div class="mt-4 rounded-2xl border border-[#D6E0E8] bg-white p-5">
        <p class="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">Agent workload</p>
        @forelse ($t['agent_workload'] as $row)
            <div class="mt-3 flex items-center gap-3">
                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#38A8D8]/20 text-[12px] font-bold text-[#2164b6]">
                    {{ strtoupper(Str::substr($row['name'], 0, 1)) }}
                </span>
                <span class="w-48 shrink-0 truncate text-[13px] font-semibold text-[#102840]">{{ $row['name'] }}</span>
                <div class="h-2 flex-1 overflow-hidden rounded-full bg-[#F0F4F8]">
                    @php
                        $max = max(1, collect($t['agent_workload'])->max('open'));
                        $pct = (int) round(($row['open'] / $max) * 100);
                    @endphp
                    <div class="h-full rounded-full bg-[#38A8D8]" style="width: {{ $pct }}%"></div>
                </div>
                <span class="w-8 shrink-0 text-right text-[12px] font-bold text-[#667085]">{{ $row['open'] }}</span>
            </div>
        @empty
            <p class="mt-2 text-[12px] text-[#98A2B3]">No assigned open tickets.</p>
        @endforelse
    </div>

    <!-- Help analytics -->
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <p class="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">Help Center</p>
            <dl class="mt-3 divide-y divide-[#F0F4F8]">
                <div class="flex items-center justify-between py-2.5">
                    <dt class="text-[13px] text-[#667085]">Article views</dt>
                    <dd class="text-[13px] font-bold text-[#102840]">{{ number_format($h['article_views']) }}</dd>
                </div>
                <div class="flex items-center justify-between py-2.5">
                    <dt class="text-[13px] text-[#667085]">Searches</dt>
                    <dd class="text-[13px] font-bold text-[#102840]">{{ number_format($h['searches']) }}</dd>
                </div>
                <div class="flex items-center justify-between py-2.5">
                    <dt class="text-[13px] text-[#667085]">Zero-result searches</dt>
                    <dd class="text-[13px] font-bold text-[#B42318]">{{ number_format($h['zero_result_searches']) }}</dd>
                </div>
                <div class="flex items-center justify-between py-2.5">
                    <dt class="text-[13px] text-[#667085]">Helpful votes</dt>
                    <dd class="text-[13px] font-bold text-[#102840]">{{ number_format($h['article_helpfulness']['helpful']) }} / {{ number_format($h['article_helpfulness']['total']) }}</dd>
                </div>
                <div class="flex items-center justify-between py-2.5">
                    <dt class="text-[13px] text-[#667085]">Helpfulness rate</dt>
                    <dd class="text-[13px] font-bold text-[#15803D]">{{ $h['article_helpfulness']['rate'] }}%</dd>
                </div>
            </dl>
        </div>

        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <p class="text-[12px] font-bold uppercase tracking-wide text-[#98A2B3]">Live averages</p>
            <dl class="mt-3 divide-y divide-[#F0F4F8]">
                <div class="flex items-center justify-between py-2.5">
                    <dt class="text-[13px] text-[#667085]">First response</dt>
                    <dd class="text-[13px] font-bold text-[#102840]">{{ $t['avg_first_response_min'] === null ? 'No replies yet' : number_format($t['avg_first_response_min']).' min' }}</dd>
                </div>
                <div class="flex items-center justify-between py-2.5">
                    <dt class="text-[13px] text-[#667085]">Resolution</dt>
                    <dd class="text-[13px] font-bold text-[#102840]">{{ $t['avg_resolution_min'] === null ? 'No resolutions yet' : number_format($t['avg_resolution_min']).' min' }}</dd>
                </div>
                <div class="flex items-center justify-between py-2.5">
                    <dt class="text-[13px] text-[#667085]">SLA breaches</dt>
                    <dd class="text-[13px] font-bold {{ $t['sla_breaches'] > 0 ? 'text-[#B42318]' : 'text-[#15803D]' }}">{{ number_format($t['sla_breaches']) }}</dd>
                </div>
            </dl>
        </div>
    </div>
@endsection