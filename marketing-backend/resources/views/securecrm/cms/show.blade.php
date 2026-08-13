@extends('securecrm.layouts.app')

@section('title', $item->title ?? $item->slug)
@section('crumb', 'SecureCRM / Content / Website CMS')
@section('heading', $item->title ?? $item->slug)

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
            <a href="{{ route('securecrm.cms', ['section' => $section]) }}" class="text-[12px] font-semibold text-[#2164b6]">← {{ $definition['label'] }}</a>
            <span class="text-[#98A2B3]">/</span>
            <span class="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide
                {{ $item->state === 'published' ? 'bg-[#16A34A]/10 text-[#15803D]'
                    : ($item->state === 'scheduled' ? 'bg-[#9a6b00]/10 text-[#9a6b00]'
                    : ($item->state === 'archived' ? 'bg-[#F2D0D0] text-[#B42318]'
                    : 'bg-[#F59E0B]/10 text-[#9a5b00]')) }}">
                {{ $item->state }}
            </span>
            <span class="text-[11px] text-[#98A2B3]">/{{ $item->slug }} · order {{ $item->sort_order }}</span>
        </div>

        @php
            $canEdit = $staff?->hasPermission('cms.edit');
            $canPublish = $staff?->hasPermission('cms.publish');
        @endphp

        <div class="flex flex-wrap items-center gap-2">
            <a href="{{ route('securecrm.cms.preview', ['cms' => $item, 'section' => $section]) }}" class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[12px] font-bold text-[#667085] transition-colors hover:bg-[#F0F5F8]">Preview</a>
            @if ($canEdit)
                <a href="{{ route('securecrm.cms.edit', ['cms' => $item, 'section' => $section]) }}" class="rounded-lg bg-[#2164b6] px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#1b52a0]">Edit</a>
            @endif
        </div>
    </div>

    <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <!-- Left: content + revisions -->
        <div class="space-y-6 xl:col-span-2">
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h2 class="text-[15px] font-bold text-[#102840]">Content fields</h2>
                <dl class="mt-4 space-y-3">
                    @if ($item->excerpt)
                        <div>
                            <dt class="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">Excerpt</dt>
                            <dd class="mt-0.5 text-[13px] text-[#475467]">{{ $item->excerpt }}</dd>
                        </div>
                    @endif
                    @foreach (($definition['fields'] ?? []) as $field)
                        @php
                            $key = $field['key'];
                            $value = $item->content[$key] ?? null;
                        @endphp
                        @if ($value !== null && $value !== '' && $value !== false)
                            <div>
                                <dt class="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">{{ $field['label'] }}</dt>
                                <dd class="mt-0.5 text-[13px] whitespace-pre-wrap text-[#475467]">{{ is_array($value) ? implode("\n", $value) : (is_bool($value) ? ($value ? 'Yes' : 'No') : $value) }}</dd>
                            </div>
                        @endif
                    @endforeach
                    @if ($item->body)
                        <div>
                            <dt class="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">Body</dt>
                            <dd class="mt-0.5 text-[13px] whitespace-pre-wrap text-[#475467]">{{ Str::limit($item->body, 600) }}</dd>
                        </div>
                    @endif
                    @if (blank($item->content) && blank($item->body) && blank($item->excerpt))
                        <p class="text-[12px] text-[#98A2B3]">No content stored for this item yet.</p>
                    @endif
                </dl>
            </div>

            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h2 class="text-[15px] font-bold text-[#102840]">Revision history</h2>
                <p class="mt-0.5 text-[12px] text-[#98A2B3]">Every save keeps the previous version. Restoring a revision snapshots the current state first, so it is always reversible.</p>
                <div class="mt-4 space-y-3">
                    @forelse ($item->revisions->sortByDesc('revision_number') as $revision)
                        <div class="flex items-start justify-between gap-4 rounded-xl border border-[#D6E0E8] p-3">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                    <p class="text-[13px] font-bold text-[#102840]">#{{ $revision->revision_number }}</p>
                                    @if ($revision->note)
                                        <span class="truncate text-[12px] text-[#667085]">— {{ $revision->note }}</span>
                                    @endif
                                </div>
                                <p class="mt-0.5 text-[11px] text-[#98A2B3]">{{ $revision->created_at?->diffForHumans() }}</p>
                            </div>
                            @if ($canEdit)
                                <form method="POST" action="{{ route('securecrm.cms.revisions.restore', ['cms' => $item, 'revision' => $revision, 'section' => $section]) }}" onsubmit="return confirm('Restore this version? The current state will be kept as a new revision.')">
                                    @csrf
                                    <button type="submit" class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[11px] font-bold text-[#667085] transition-colors hover:bg-[#F0F5F8]">Restore</button>
                                </form>
                            @endif
                        </div>
                    @empty
                        <p class="text-[12px] text-[#98A2B3]">No revisions yet.</p>
                    @endforelse
                </div>
            </div>
        </div>

        <!-- Right: actions -->
        <div class="space-y-6">
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h2 class="text-[15px] font-bold text-[#102840]">Workflow</h2>
                <p class="mt-1 text-[12px] text-[#667085]">Content moves draft → review → published. Changes only reach the public site when published.</p>

                @if ($canPublish)
                    <div class="mt-4 space-y-2">
                        @if ($item->state !== 'published')
                            <form method="POST" action="{{ route('securecrm.cms.publish', ['cms' => $item, 'section' => $section]) }}">
                                @csrf
                                <button type="submit" class="w-full rounded-lg bg-[#16A34A] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#15803D]">Publish now</button>
                            </form>
                        @endif
                        @if ($item->state === 'published')
                            <form method="POST" action="{{ route('securecrm.cms.unpublish', ['cms' => $item, 'section' => $section]) }}">
                                @csrf
                                <button type="submit" class="w-full rounded-lg border border-[#D6E0E8] px-4 py-2 text-[12px] font-semibold text-[#667085] transition-colors hover:bg-[#F7FAFC]">Unpublish</button>
                            </form>
                        @endif
                        @if ($item->state !== 'archived')
                            <details class="group">
                                <summary class="w-full cursor-pointer list-none rounded-lg border border-[#D6E0E8] px-4 py-2 text-center text-[12px] font-semibold text-[#667085] transition-colors hover:bg-[#F7FAFC]">Schedule publish…</summary>
                                <form method="POST" action="{{ route('securecrm.cms.schedule', ['cms' => $item, 'section' => $section]) }}" class="mt-2 space-y-2">
                                    @csrf
                                    <input type="datetime-local" name="scheduled_at" required class="w-full rounded-lg border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                    <button type="submit" class="w-full rounded-lg bg-[#102840] px-3 py-1.5 text-[12px] font-semibold text-white">Schedule publish</button>
                                </form>
                            </details>
                        @endif
                        @if ($item->state === 'archived')
                            <form method="POST" action="{{ route('securecrm.cms.restore', ['cms' => $item, 'section' => $section]) }}">
                                @csrf
                                <button type="submit" class="w-full rounded-lg bg-[#102840] px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[#1e3f61]">Restore</button>
                            </form>
                        @else
                            <form method="POST" action="{{ route('securecrm.cms.archive', ['cms' => $item, 'section' => $section]) }}">
                                @csrf
                                <button type="submit" class="w-full rounded-lg border border-[#DC2626]/30 px-4 py-2 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#DC2626]/5">Archive</button>
                            </form>
                        @endif
                    </div>
                @else
                    @if ($canEdit)
                        <p class="mt-4 rounded-lg bg-[#F0F5F8] px-4 py-3 text-[12px] text-[#667085]">You can view and edit content, but publishing requires the <span class="font-semibold">cms.publish</span> permission.</p>
                    @else
                        <p class="mt-4 rounded-lg bg-[#F0F5F8] px-4 py-3 text-[12px] text-[#667085]">Publishing requires the <span class="font-semibold">cms.publish</span> permission.</p>
                    @endif
                @endif
            </div>
        </div>
    </div>
@endsection
