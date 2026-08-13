@extends('securecrm.layouts.app')

@section('title', 'Overview')
@section('crumb', 'SecureCRM / Main')
@section('heading', 'Overview')

@section('content')
    <!-- KPI cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        @php
            $kpiCards = [
                ['label' => 'Open tickets', 'value' => number_format($kpi['open_tickets']), 'icon' => 'tickets', 'accent' => '#2164b6'],
                ['label' => 'New tickets', 'value' => number_format($kpi['new_tickets']), 'icon' => 'automation', 'accent' => '#38A8D8'],
                ['label' => 'Published articles', 'value' => number_format($kpi['published_articles']), 'icon' => 'help', 'accent' => '#16A34A'],
                ['label' => 'Active agents', 'value' => number_format($kpi['agent_count']), 'icon' => 'agents', 'accent' => '#F59E0B'],
            ];
        @endphp
        @foreach ($kpiCards as $card)
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
                <div class="flex items-center justify-between">
                    <p class="text-[12px] font-semibold uppercase tracking-wide text-[#98A2B3]">{{ $card['label'] }}</p>
                    <span class="flex h-8 w-8 items-center justify-center rounded-lg" style="background-color: {{ $card['accent'] }}1A; color: {{ $card['accent'] }}">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
                            @php
                                $icons = [
                                    'tickets' => '<path d="M4 4h16v16H4Z"/><line x1="8" x2="20" y1="9" y2="9"/><line x1="8" x2="20" y1="15" y2="15"/><line x1="8" x2="20" y1="18" y2="18"/>',
                                    'automation' => '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
                                    'help' => '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a2.8 2.8 0 0 1 5.6 0c0 1.8-2.8 2.2-2.8 4"/><path d="M12 17h.01"/>',
                                    'agents' => '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>',
                                ];
                            @endphp
                            {!! $icons[$card['icon']] !!}
                        </svg>
                    </span>
                </div>
                <p class="mt-2 text-2xl font-black tracking-tight text-[#102840]">{{ $card['value'] }}</p>
            </div>
        @endforeach
    </div>

    <!-- Helpful vs not helpful + top categories -->
    <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <!-- Feedback breakdown -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <h2 class="text-[15px] font-bold text-[#102840]">Was this helpful?</h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">Feedback recorded on public help articles</p>
            <div class="mt-5 flex h-2.5 w-full overflow-hidden rounded-full bg-[#F0F5F8]">
                @php
                    $total = max($kpi['helpful'] + $kpi['not_helpful'], 1);
                    $pctHelpful = round(($kpi['helpful'] / $total) * 100);
                    $pctNot = 100 - $pctHelpful;
                @endphp
                <div class="bg-[#16A34A]" style="width: {{ $pctHelpful }}%"></div>
                <div class="bg-[#DC2626]" style="width: {{ $pctNot }}%"></div>
            </div>
            <div class="mt-4 flex items-center justify-around text-center">
                <div>
                    <p class="text-xl font-black text-[#16A34A]">{{ number_format($kpi['helpful']) }}</p>
                    <p class="text-[11px] font-medium text-[#98A2B3]">Helpful</p>
                </div>
                <div>
                    <p class="text-xl font-black text-[#DC2626]">{{ number_format($kpi['not_helpful']) }}</p>
                    <p class="text-[11px] font-medium text-[#98A2B3]">Not helpful</p>
                </div>
                <div>
                    <p class="text-xl font-black text-[#102840]">{{ $pctHelpful }}%</p>
                    <p class="text-[11px] font-medium text-[#98A2B3]">Satisfaction</p>
                </div>
            </div>
        </div>

        <!-- Top searched terms -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <h2 class="text-[15px] font-bold text-[#102840]">Top searched terms</h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">{{ number_format($kpi['top_searches']) }} total searches logged</p>
            @if ($topSearches->count() === 0)
                <p class="mt-4 text-[13px] text-[#98A2B3]">No searches recorded yet.</p>
            @else
                <ol class="mt-4 space-y-2.5">
                    @foreach ($topSearches as $term)
                        <li class="flex items-center justify-between gap-3">
                            <span class="truncate text-[13px] font-semibold text-[#102840]">{{ $term->query }}</span>
                            <span class="shrink-0 rounded-full bg-[#F0F5F8] px-2 py-0.5 text-[11px] font-bold text-[#667085]">{{ $term->hits }}×</span>
                        </li>
                    @endforeach
                </ol>
            @endif
        </div>

        <!-- Latest searches -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <h2 class="text-[15px] font-bold text-[#102840]">Latest searches</h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">Most recent queries from the public help center</p>
            @if ($latestSearches->count() === 0)
                <p class="mt-4 text-[13px] text-[#98A2B3]">No searches recorded yet.</p>
            @else
                <ul class="mt-4 space-y-2">
                    @foreach ($latestSearches as $term)
                        <li class="flex items-center justify-between gap-3 text-[13px]">
                            <span class="truncate font-medium text-[#102840]">{{ $term->query }}</span>
                            <span class="shrink-0 text-[11px] text-[#98A2B3]">{{ $term->created_at?->diffForHumans() }}</span>
                        </li>
                    @endforeach
                </ul>
            @endif
        </div>
    </div>

    <!-- Top categories + recent articles -->
    <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
            <h2 class="text-[15px] font-bold text-[#102840]">Top categories</h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">By published article count</p>
            <div class="mt-4 space-y-3">
                @foreach ($topCategories as $category)
                    <div>
                        <div class="flex items-center justify-between text-[13px]">
                            <span class="font-semibold text-[#102840]">{{ $category->name }}</span>
                            <span class="text-[#98A2B3]">{{ $category->articles_count }} articles</span>
                        </div>
                    </div>
                @endforeach
            </div>
        </div>

        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5 xl:col-span-2">
            <h2 class="text-[15px] font-bold text-[#102840]">Recently published articles</h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">Latest additions to the public help center</p>
            <div class="mt-4 divide-y divide-[#F0F5F8]">
                @foreach ($recentArticles as $article)
                    <div class="flex items-center justify-between gap-3 py-2.5">
                        <div class="min-w-0">
                            <p class="truncate text-[13px] font-semibold text-[#102840]">{{ $article->title }}</p>
                            <p class="text-[11px] text-[#98A2B3]">{{ $article->category?->name }} · {{ $article->published_at?->format('M j, Y') }}</p>
                        </div>
                        <span class="shrink-0 rounded-full bg-[#16A34A]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#16A34A]">Published</span>
                    </div>
                @endforeach
            </div>
        </div>
    </div>
@endsection