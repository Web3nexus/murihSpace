@extends('securecrm.layouts.app')

@section('title', 'Website CMS')
@section('crumb', 'SecureCRM / Content')
@section('heading', 'Website CMS')

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

    <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
        <div class="flex flex-wrap gap-1.5">
            @foreach ($sections as $key => $definition)
                <a href="{{ route('securecrm.cms', ['section' => $key]) }}"
                   class="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors
                   {{ $active === $key ? 'bg-[#102840] text-white' : 'bg-white text-[#667085] border border-[#D6E0E8] hover:bg-[#F0F5F8]' }}">
                    {{ $definition['label'] }}
                </a>
            @endforeach
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#D6E0E8] pt-5">
            <div>
                <h2 class="text-[15px] font-bold text-[#102840]">{{ $sections[$active]['label'] }}</h2>
                <p class="mt-0.5 text-[12px] text-[#98A2B3]">
                    @if (($sections[$active]['kind'] ?? 'collection') === 'single')
                        This section is a single content item. Edit it and publish to make changes live.
                    @else
                        Ordered list of items shown on the public site. Publish to make live.
                    @endif
                </p>
            </div>
            <div class="flex flex-wrap gap-2">
                <a href="{{ route('securecrm.cms.create', ['section' => $active]) }}"
                   class="rounded-lg bg-[#2164b6] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
                    + New item
                </a>
            </div>
        </div>

        <div class="mt-5 space-y-3">
            @forelse ($items as $item)
                <div class="rounded-xl border border-[#D6E0E8] p-4">
                    <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="text-[13px] font-bold text-[#102840]">{{ $item->title ?? $item->content['title'] ?? $item->content['name'] ?? $item->slug }}</p>
                                <span class="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide
                                    {{ $item->state === 'published' ? 'bg-[#16A34A]/10 text-[#15803D]'
                                        : ($item->state === 'scheduled' ? 'bg-[#9a6b00]/10 text-[#9a6b00]'
                                        : ($item->state === 'archived' ? 'bg-[#F2D0D0] text-[#B42318]'
                                        : 'bg-[#F59E0B]/10 text-[#9a5b00]')) }}">
                                    {{ $item->state }}
                                </span>
                            </div>
                            @if ($item->excerpt)
                                <p class="mt-1 line-clamp-1 text-[12px] text-[#667085]">{{ $item->excerpt }}</p>
                            @endif
                            <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#98A2B3]">
                                <span>/{{ $item->slug }}</span>
                                <span><span class="font-bold text-[#475467]">{{ $item->revisions->count() }}</span> revisions</span>
                                <span>Order {{ $item->sort_order }}</span>
                                <span>Updated {{ $item->updated_at?->diffForHumans() }}</span>
                                @if ($item->published_at)
                                    <span>Published {{ $item->published_at?->diffForHumans() }}</span>
                                @endif
                            </div>
                        </div>

                        <div class="flex shrink-0 items-center gap-2">
                            <a href="{{ route('securecrm.cms.preview', ['cms' => $item, 'section' => $active]) }}" class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[11px] font-bold text-[#667085] transition-colors hover:bg-[#F0F5F8]">Preview</a>
                            <a href="{{ route('securecrm.cms.show', ['cms' => $item, 'section' => $active]) }}" class="rounded-lg bg-[#2164b6] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#1b52a0]">Open</a>
                        </div>
                    </div>
                </div>
            @empty
                <p class="rounded-xl border border-dashed border-[#B7C6D1] px-4 py-10 text-center text-[13px] text-[#98A2B3]">
                    No {{ $sections[$active]['label'] }} content yet.
                    @if (($sections[$active]['kind'] ?? 'collection') === 'collection')
                        <a href="{{ route('securecrm.cms.create', ['section' => $active]) }}" class="font-semibold text-[#2164b6]">Create the first item</a>.
                    @endif
                </p>
            @endforelse
        </div>

        <div class="mt-5">
            {{ $items->links() }}
        </div>
    </div>
@endsection
