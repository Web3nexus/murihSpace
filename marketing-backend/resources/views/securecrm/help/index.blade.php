@extends('securecrm.layouts.app')

@section('title', 'Help Center')
@section('crumb', 'SecureCRM / Content')
@section('heading', 'Help Center')

@section('content')
    @if (session('status'))
        <div class="mb-5 rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/10 px-4 py-3 text-[13px] font-semibold text-[#16A34A]">
            {{ session('status') }}
        </div>
    @endif

    @if (session('error'))
        <div class="mb-5 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/10 px-4 py-3 text-[13px] font-semibold text-[#DC2626]">
            {{ session('error') }}
        </div>
    @endif

    <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
            @foreach (['all' => 'All', ...collect($stateCounts)->keys()->reject(fn ($k) => $k === 'all')->mapWithKeys(fn ($k) => [$k => ucfirst($k)])->all()] as $key => $label)
                <a href="{{ route('securecrm.help', ['state' => $key === 'all' ? null : $key] + request()->except(['state', 'page'])) }}"
                   class="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors
                   {{ request('state', 'all') === $key
                       ? 'bg-[#102840] text-white'
                       : 'bg-white text-[#667085] border border-[#D6E0E8] hover:bg-[#F0F5F8]' }}">
                    {{ $label }} <span class="opacity-60">{{ $stateCounts[$key] }}</span>
                </a>
            @endforeach
        </div>
        <a href="{{ route('securecrm.help.create') }}"
           class="rounded-lg bg-[#2164b6] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
            + New article
        </a>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6 xl:col-span-2">
            <form method="GET" action="{{ route('securecrm.help') }}" class="flex flex-wrap items-center gap-3">
                <div class="min-w-[220px] flex-1">
                    <input type="search" name="q" value="{{ request('q') }}" placeholder="Search title, excerpt or slug…"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>
                <div>
                    <select name="category" onchange="this.form.submit()"
                            class="rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                        <option value="">All categories</option>
                        @foreach ($categories as $category)
                            <option value="{{ $category->id }}" @selected((int) request('category') === $category->id)>{{ $category->name }}</option>
                        @endforeach
                    </select>
                </div>
                <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                    <input type="checkbox" name="featured" value="1" @checked(request()->boolean('featured')) onchange="this.form.submit()" class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                    Featured only
                </label>
                <button type="submit" class="rounded-lg bg-[#102840] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1e3f61]">Filter</button>
                <a href="{{ route('securecrm.help') }}" class="text-[12px] font-semibold text-[#2164b6]">Reset</a>
            </form>

            <div class="mt-5 space-y-3">
                @forelse ($articles as $article)
                    <div class="rounded-xl border border-[#D6E0E8] p-4">
                        <div class="flex items-start justify-between gap-4">
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-[13px] font-bold text-[#102840]">{{ $article->title }}</p>
                                    <span class="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide
                                        {{ $article->state === 'published' ? 'bg-[#16A34A]/10 text-[#15803D]'
                                            : ($article->state === 'scheduled' ? 'bg-[#9a6b00]/10 text-[#9a6b00]'
                                            : ($article->state === 'archived' ? 'bg-[#F2D0D0] text-[#B42318]'
                                            : 'bg-[#F59E0B]/10 text-[#9a5b00]')) }}">
                                        {{ $article->state }}
                                    </span>
                                    @if ($article->featured)
                                        <span class="rounded-md bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7C3AED]">featured</span>
                                    @endif
                                    @if ($article->category)
                                        <span class="rounded-md bg-[#2164b6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2164b6]">{{ $article->category->name }}</span>
                                    @endif
                                </div>
                                @if ($article->excerpt)
                                    <p class="mt-1 line-clamp-1 text-[12px] text-[#667085]">{{ $article->excerpt }}</p>
                                @endif
                                <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#98A2B3]">
                                    <span><span class="font-bold text-[#475467]">{{ $article->revisions->count() }}</span> revisions</span>
                                    <span>{{ $article->view_count }} views</span>
                                    <span>Updated {{ $article->updated_at?->diffForHumans() }}</span>
                                    @if ($article->scheduled_at)
                                        <span class="font-bold text-[#9a6b00]">Scheduled {{ $article->scheduled_at?->diffForHumans() }}</span>
                                    @endif
                                    @if ($article->published_at)
                                        <span>Published {{ $article->published_at?->diffForHumans() }}</span>
                                    @endif
                                </div>
                            </div>

                            <div class="flex shrink-0 items-center gap-2">
                                <a href="{{ route('securecrm.help.preview', $article) }}" class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[11px] font-bold text-[#667085] transition-colors hover:bg-[#F0F5F8]">Preview</a>
                                <a href="{{ route('securecrm.help.show', $article) }}" class="rounded-lg bg-[#2164b6] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#1b52a0]">Open</a>
                            </div>
                        </div>
                    </div>
                @empty
                    <p class="rounded-xl border border-dashed border-[#B7C6D1] px-4 py-10 text-center text-[13px] text-[#98A2B3]">
                        No help articles match those filters.
                    </p>
                @endforelse
            </div>

            <div class="mt-5">
                {{ $articles->links() }}
            </div>
        </div>

        <div class="space-y-6">
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h2 class="text-[15px] font-bold text-[#102840]">Workflow</h2>
                <p class="mt-1 text-[12px] text-[#667085]">Articles move draft → review → published. Every save keeps a full recoverable revision of the previous version, so the last published state can always be restored.</p>
                <ul class="mt-4 space-y-2 text-[12px] text-[#475467]">
                    <li class="flex items-center gap-2"><span class="size-2 rounded-full bg-[#F59E0B]"></span> Draft — being written</li>
                    <li class="flex items-center gap-2"><span class="size-2 rounded-full bg-[#2164b6]"></span> Review — waiting for sign-off</li>
                    <li class="flex items-center gap-2"><span class="size-2 rounded-full bg-[#9a6b00]"></span> Scheduled — publishes automatically</li>
                    <li class="flex items-center gap-2"><span class="size-2 rounded-full bg-[#16A34A]"></span> Published — live on the public site</li>
                    <li class="flex items-center gap-2"><span class="size-2 rounded-full bg-[#DC2626]"></span> Archived — hidden, restorable</li>
                </ul>
            </div>
            <a href="{{ route('securecrm.help.categories') }}" class="flex items-center justify-between rounded-2xl border border-[#D6E0E8] bg-white p-6 transition-colors hover:border-[#2164b6]/40">
                <div>
                    <h2 class="text-[15px] font-bold text-[#102840]">Categories</h2>
                    <p class="mt-0.5 text-[12px] text-[#667085]">Organise articles into {{ $categories->count() }} categories.</p>
                </div>
                <span class="text-[#2164b6]">→</span>
            </a>
        </div>
    </div>
@endsection
