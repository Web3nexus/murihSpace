@extends('securecrm.layouts.app')

@section('title', 'Announcements')
@section('crumb', 'SecureCRM / Content')
@section('heading', 'Announcements')

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
            @foreach (['all' => 'All', ...collect($states)->mapWithKeys(fn ($s) => [$s => ucfirst($s)])->all()] as $key => $label)
                <a href="{{ route('securecrm.announcements', ['state' => $key === 'all' ? null : $key]) }}"
                   class="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors
                   {{ request('state', 'all') === $key
                       ? 'bg-[#102840] text-white'
                       : 'bg-white text-[#667085] border border-[#D6E0E8] hover:bg-[#F0F5F8]' }}">
                    {{ $label }}
                </a>
            @endforeach
        </div>
        <a href="{{ route('securecrm.announcements.create') }}"
           class="rounded-lg bg-[#2164b6] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
            + New announcement
        </a>
    </div>

    <div class="mt-5 space-y-3">
        @forelse ($announcements as $announcement)
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-2">
                            <p class="text-[13px] font-bold text-[#102840]">{{ $announcement->title }}</p>
                            <span class="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide
                                {{ $announcement->state === 'published' ? 'bg-[#16A34A]/10 text-[#15803D]'
                                    : ($announcement->state === 'scheduled' ? 'bg-[#9a6b00]/10 text-[#9a6b00]'
                                    : ($announcement->state === 'archived' ? 'bg-[#F2D0D0] text-[#B42318]'
                                    : 'bg-[#F59E0B]/10 text-[#9a5b00]')) }}">
                                {{ $announcement->state }}
                            </span>
                            @if ($announcement->featured)
                                <span class="rounded-md bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7C3AED]">featured</span>
                            @endif
                        </div>
                        @if ($announcement->body)
                            <p class="mt-1 line-clamp-1 text-[12px] text-[#667085]">{{ $announcement->body }}</p>
                        @endif
                        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#98A2B3]">
                            <span>Updated {{ $announcement->updated_at?->diffForHumans() }}</span>
                            @if ($announcement->published_at)
                                <span>Published {{ $announcement->published_at?->diffForHumans() }}</span>
                            @endif
                            @if ($announcement->scheduled_at)
                                <span class="font-bold text-[#9a6b00]">Scheduled {{ $announcement->scheduled_at?->diffForHumans() }}</span>
                            @endif
                        </div>
                    </div>

                    <div class="flex shrink-0 items-center gap-2">
                        <a href="{{ route('securecrm.announcements.edit', $announcement) }}" class="rounded-lg bg-[#2164b6] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#1b52a0]">Open</a>
                    </div>
                </div>
            </div>
        @empty
            <p class="rounded-xl border border-dashed border-[#B7C6D1] px-4 py-10 text-center text-[13px] text-[#98A2B3]">
                No announcements yet. <a href="{{ route('securecrm.announcements.create') }}" class="font-semibold text-[#2164b6]">Create the first one</a>.
            </p>
        @endforelse
    </div>

    <div class="mt-5">
        {{ $announcements->links() }}
    </div>
@endsection
