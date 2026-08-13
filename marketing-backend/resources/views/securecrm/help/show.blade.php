@extends('securecrm.layouts.app')

@section('title', $article->title)
@section('crumb', 'SecureCRM / Content / Help Center')
@section('heading', $article->title)

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
            <span class="rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide
                {{ $article->state === 'published' ? 'bg-[#16A34A]/10 text-[#15803D]'
                    : ($article->state === 'scheduled' ? 'bg-[#9a6b00]/10 text-[#9a6b00]'
                    : ($article->state === 'archived' ? 'bg-[#F2D0D0] text-[#B42318]'
                    : 'bg-[#F59E0B]/10 text-[#9a5b00]')) }}">
                {{ $article->state }}
            </span>
            @if ($article->category)
                <span class="rounded-md bg-[#2164b6]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#2164b6]">{{ $article->category->name }}</span>
            @endif
            @if ($article->featured)
                <span class="rounded-md bg-[#7C3AED]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#7C3AED]">Featured</span>
            @endif
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <a href="{{ route('securecrm.help.preview', $article) }}" class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[12px] font-bold text-[#667085] transition-colors hover:bg-[#F0F5F8]">Preview</a>
            <a href="{{ route('securecrm.help.edit', $article) }}" class="rounded-lg bg-[#2164b6] px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#1b52a0]">Edit article</a>
            <a href="{{ route('securecrm.help') }}" class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[12px] font-bold text-[#667085] transition-colors hover:bg-[#F0F5F8]">← Back</a>
        </div>
    </div>

    <!-- State actions -->
    @auth('staff')
    @php $staff = auth('staff')->user(); @endphp
    @if ($staff->hasPermission('help.article.publish') && in_array($article->state, ['draft', 'review']))
        <form method="POST" action="{{ route('securecrm.help.publish', $article) }}" class="mt-4">
            @csrf
            <button type="submit" class="rounded-lg bg-[#16A34A] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#15803D]">Publish now</button>
        </form>
    @endif
    @if ($staff->hasPermission('help.article.publish') && $article->state === 'published')
        <form method="POST" action="{{ route('securecrm.help.unpublish', $article) }}" class="mt-4 inline-block">
            @csrf
            <button type="submit" class="rounded-lg bg-[#F59E0B] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#b45309]">Unpublish</button>
        </form>
    @endif
    @if ($staff->hasPermission('help.article.archive') && ! in_array($article->state, ['archived']))
        <form method="POST" action="{{ route('securecrm.help.archive', $article) }}" class="mt-4 inline-block">
            @csrf
            <button type="submit" class="rounded-lg bg-[#DC2626] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#b91c1c]">Archive</button>
        </form>
    @endif
    @if ($staff->hasPermission('help.article.archive') && $article->state === 'archived')
        <form method="POST" action="{{ route('securecrm.help.restore', $article) }}" class="mt-4 inline-block">
            @csrf
            <button type="submit" class="rounded-lg bg-[#2164b6] px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-[#1b52a0]">Restore as draft</button>
        </form>
    @endif
    @if ($staff->hasPermission('help.article.publish') && in_array($article->state, ['draft', 'review']))
        <details class="mt-4 inline-block align-middle">
            <summary class="cursor-pointer rounded-lg border border-[#D6E0E8] px-3 py-2 text-[12px] font-bold text-[#667085]">Schedule…</summary>
            <form method="POST" action="{{ route('securecrm.help.schedule', $article) }}" class="mt-2 flex items-center gap-2 rounded-xl border border-[#D6E0E8] bg-white p-3">
                @csrf
                <input type="datetime-local" name="scheduled_at" required class="rounded-lg border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                <button type="submit" class="rounded-lg bg-[#102840] px-3 py-1.5 text-[12px] font-semibold text-white">Schedule publish</button>
            </form>
        </details>
    @endif
    @endauth

    <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <!-- Left: content + revisions -->
        <div class="space-y-6 xl:col-span-2">
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h2 class="text-[15px] font-bold text-[#102840]">Content</h2>
                @if ($article->excerpt)
                    <p class="mt-3 text-[14px] leading-relaxed text-[#667085]">{{ $article->excerpt }}</p>
                @endif

                @if ($article->sections)
                    <div class="mt-6 space-y-6">
                        @foreach ($article->sections as $i => $section)
                            <section>
                                <h3 class="flex items-center gap-2 text-[16px] font-bold tracking-tight text-[#102840]">
                                    <span class="h-2 w-1 rounded-full bg-[#2164b6]"></span>{{ $section['heading'] }}
                                </h3>
                                <p class="mt-2 whitespace-pre-line text-[14px] leading-relaxed text-[#4A5A6E]">{{ $section['body'] }}</p>
                            </section>
                        @endforeach
                    </div>
                @elseif ($article->body)
                    <div class="mt-6 rounded-xl bg-[#F7FAFC] p-4">
                        <p class="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[#475467]">{{ $article->body }}</p>
                    </div>
                @else
                    <p class="mt-4 text-[13px] text-[#98A2B3]">No body content yet.</p>
                @endif
            </div>

            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h2 class="text-[15px] font-bold text-[#102840]">Revision history</h2>
                <p class="mt-0.5 text-[12px] text-[#98A2B3]">Every save keeps the previous version. Restoring a revision snapshots the current state first, so it is always reversible.</p>
                <div class="mt-4 space-y-3">
                    @forelse ($article->revisions->sortByDesc('revision_number') as $revision)
                        <div class="flex items-start justify-between gap-4 rounded-xl border border-[#D6E0E8] p-3">
                            <div class="min-w-0">
                                <div class="flex items-center gap-2">
                                    <p class="text-[13px] font-bold text-[#102840]">#{{ $revision->revision_number }}</p>
                                    @if ($revision->note)
                                        <span class="truncate text-[12px] text-[#667085]">— {{ $revision->note }}</span>
                                    @endif
                                </div>
                                <p class="mt-0.5 text-[11px] text-[#98A2B3]">{{ $revision->created_at?->diffForHumans() }} · {{ $revision->created_by_type ? 'by staff #'.$revision->created_by_id : 'import' }}</p>
                            </div>
                            @if (! $loop->first)
                                <form method="POST" action="{{ route('securecrm.help.revisions.restore', [$article, $revision]) }}"
                                      onsubmit="return confirm('Restore article content to revision #{{ $revision->revision_number }}? Current state will be kept as a new revision.')">
                                    @csrf
                                    <button type="submit" class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[11px] font-bold text-[#2164b6] transition-colors hover:bg-[#2164b6]/5">Restore</button>
                                </form>
                            @endif
                        </div>
                    @empty
                        <p class="text-[12px] text-[#98A2B3]">No revisions yet.</p>
                    @endforelse
                </div>
            </div>
        </div>

        <!-- Right: details -->
        <div class="space-y-6">
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h2 class="text-[15px] font-bold text-[#102840]">Details</h2>
                <dl class="mt-4 space-y-3 text-[12px]">
                    <div class="flex justify-between gap-3"><dt class="text-[#98A2B3]">Slug</dt><dd class="font-semibold text-[#102840]">{{ $article->slug }}</dd></div>
                    <div class="flex justify-between gap-3"><dt class="text-[#98A2B3]">Views</dt><dd class="font-semibold text-[#102840]">{{ number_format($article->view_count) }}</dd></div>
                    <div class="flex justify-between gap-3"><dt class="text-[#98A2B3]">Helpful</dt><dd class="font-semibold text-[#16A34A]">{{ $article->helpful_count }} / {{ $article->not_helpful_count }}</dd></div>
                    <div class="flex justify-between gap-3"><dt class="text-[#98A2B3]">Created</dt><dd class="font-semibold text-[#102840]">{{ $article->created_at?->toFormattedDateString() }}</dd></div>
                    <div class="flex justify-between gap-3"><dt class="text-[#98A2B3]">Updated</dt><dd class="font-semibold text-[#102840]">{{ $article->updated_at?->diffForHumans() }}</dd></div>
                    @if ($article->published_at)
                        <div class="flex justify-between gap-3"><dt class="text-[#98A2B3]">Published</dt><dd class="font-semibold text-[#102840]">{{ $article->published_at?->toFormattedDateString() }}</dd></div>
                    @endif
                    @if ($article->scheduled_at)
                        <div class="flex justify-between gap-3"><dt class="text-[#98A2B3]">Scheduled</dt><dd class="font-semibold text-[#9a6b00]">{{ $article->scheduled_at?->diffForHumans() }}</dd></div>
                    @endif
                    @if ($article->keywords)
                        <div class="flex justify-between gap-3"><dt class="text-[#98A2B3]">Keywords</dt><dd class="flex flex-wrap gap-1 justify-end">@foreach ($article->keywords as $k)<span class="rounded bg-[#F0F5F8] px-1.5 py-0.5 text-[10px] font-semibold text-[#475467]">{{ $k }}</span>@endforeach</dd></div>
                    @endif
                    @if ($article->tags)
                        <div class="flex justify-between gap-3"><dt class="text-[#98A2B3]">Tags</dt><dd class="flex flex-wrap gap-1 justify-end">@foreach ($article->tags as $t)<span class="rounded bg-[#2164b6]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#2164b6]">{{ $t }}</span>@endforeach</dd></div>
                    @endif
                </dl>
            </div>

            @if ($article->relatedArticles->isNotEmpty())
                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <h2 class="text-[15px] font-bold text-[#102840]">Related articles</h2>
                    <ul class="mt-3 space-y-2">
                        @foreach ($article->relatedArticles as $related)
                            <li>
                                <a href="{{ route('securecrm.help.show', $related) }}" class="text-[12px] font-semibold text-[#2164b6] hover:underline">{{ $related->title }}</a>
                            </li>
                        @endforeach
                    </ul>
                </div>
            @endif

            <!-- Attachments -->
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h2 class="text-[15px] font-bold text-[#102840]">Attachments</h2>
                <ul class="mt-3 space-y-2">
                    @forelse ($article->attachments as $attachment)
                        <li class="flex items-center justify-between gap-3 rounded-lg border border-[#D6E0E8] px-3 py-2">
                            <a href="{{ route('securecrm.help.attachments.download', $attachment) }}" class="min-w-0 flex-1 truncate text-[12px] font-semibold text-[#2164b6] hover:underline">{{ $attachment->filename }}</a>
                            <span class="shrink-0 text-[10px] text-[#98A2B3]">{{ number_format($attachment->size / 1024, 1) }} KB</span>
                            <form method="POST" action="{{ route('securecrm.help.attachments.destroy', $attachment) }}" onsubmit="return confirm('Remove attachment?')">
                                @csrf
                                @method('DELETE')
                                <button type="submit" class="shrink-0 text-[11px] font-bold text-[#DC2626] hover:underline">Remove</button>
                            </form>
                        </li>
                    @empty
                        <li class="text-[12px] text-[#98A2B3]">No attachments.</li>
                    @endforelse
                </ul>

                @auth('staff')
                @if (auth('staff')->user()->hasPermission('help.article.edit'))
                    <form method="POST" action="{{ route('securecrm.help.attachments.store', $article) }}" enctype="multipart/form-data" class="mt-4">
                        @csrf
                        <label class="block cursor-pointer rounded-xl border border-dashed border-[#B7C6D1] px-4 py-5 text-center text-[12px] font-semibold text-[#667085] transition-colors hover:border-[#2164b6] hover:text-[#2164b6]">
                            Upload a file (max 10 MB)
                            <input type="file" name="attachment" class="hidden" onchange="this.form.submit()">
                        </label>
                    </form>
                @endif
                @endauth
            </div>
        </div>
    </div>
@endsection
