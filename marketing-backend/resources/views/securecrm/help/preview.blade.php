@extends('securecrm.layouts.app')

@section('title', 'Preview · '.$article->title)
@section('crumb', 'SecureCRM / Content / Help Center')
@section('heading', 'Article preview')

@section('content')
    <div class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#2164b6]/30 bg-[#2164b6]/10 px-4 py-3">
        <p class="text-[13px] font-semibold text-[#2164b6]">
            Staff preview — this is how the public sees the article.
            @if ($article->state !== 'published')
                Current state: <span class="uppercase">{{ $article->state }}</span> (not live yet).
            @endif
        </p>
        <a href="{{ route('securecrm.help.show', $article) }}" class="rounded-lg bg-white px-3 py-1.5 text-[12px] font-bold text-[#2164b6] shadow-sm">Back to article</a>
    </div>

    <div class="rounded-2xl border border-[#D6E0E8] bg-white p-8">
        <div class="mx-auto max-w-3xl">
            @if ($article->category)
                <p class="text-[12px] font-bold uppercase tracking-wide text-[#2164b6]">{{ $article->category->name }}</p>
            @endif
            <h1 class="mt-3 text-3xl font-black tracking-tight text-[#102840]">{{ $article->title }}</h1>
            @if ($article->excerpt)
                <p class="mt-3 text-[16px] leading-relaxed text-[#667085]">{{ $article->excerpt }}</p>
            @endif

            @if ($article->sections)
                <div class="mt-8 space-y-7">
                    @foreach ($article->sections as $section)
                        <section>
                            <h2 class="flex items-center gap-2 text-[20px] font-bold tracking-tight text-[#102840]">
                                <span class="h-2 w-1 rounded-full bg-[#2164b6]"></span>{{ $section['heading'] }}
                            </h2>
                            <p class="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-[#4A5A6E]">{{ $section['body'] }}</p>
                        </section>
                    @endforeach
                </div>
            @elseif ($article->body)
                <div class="mt-8 rounded-xl bg-[#F7FAFC] p-4">
                    <p class="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-[#475467]">{{ $article->body }}</p>
                </div>
            @else
                <p class="mt-8 text-[14px] text-[#98A2B3]">This article has no content yet.</p>
            @endif

            @if ($article->relatedArticles->isNotEmpty())
                <div class="mt-12 rounded-2xl border border-[#D6E0E8] bg-[#F7FAFC] p-6">
                    <p class="text-[13px] font-bold text-[#102840]">Related articles</p>
                    <ul class="mt-3 space-y-2">
                        @foreach ($article->relatedArticles as $related)
                            <li class="text-[13px] font-semibold text-[#2164b6]">{{ $related->title }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif
        </div>
    </div>
@endsection
