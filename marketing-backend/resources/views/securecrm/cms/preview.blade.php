@extends('securecrm.layouts.app')

@section('title', 'Preview · ' . ($item->title ?? $item->slug))
@section('crumb', 'SecureCRM / Content / Website CMS')
@section('heading', 'Preview')

@section('content')
    <div class="mb-5 rounded-xl border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-3 text-[13px] font-semibold text-[#9a5b00]">
        This is a staff preview. The item is
        <span class="font-bold uppercase">{{ $item->state }}</span> — it is {{ $item->state === 'published' ? 'live on the public site' : 'not yet live to visitors' }}.
    </div>

    <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
        <p class="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">{{ $definition['label'] }} · /{{ $item->slug }}</p>
        <h1 class="mt-2 text-2xl font-bold tracking-tight text-[#102840]">{{ $item->title ?? $item->content['title'] ?? $item->content['name'] ?? $item->slug }}</h1>
        @if ($item->excerpt)
            <p class="mt-2 text-[14px] text-[#667085]">{{ $item->excerpt }}</p>
        @endif

        <div class="mt-6 space-y-4">
            @foreach (($definition['fields'] ?? []) as $field)
                @php
                    $value = $item->content[$field['key']] ?? null;
                @endphp
                @if ($value !== null && $value !== '' && $value !== false)
                    <div>
                        <p class="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">{{ $field['label'] }}</p>
                        <p class="mt-0.5 text-[13px] whitespace-pre-wrap text-[#475467]">
                            {{ is_array($value) ? implode("\n", $value) : (is_bool($value) ? ($value ? 'Yes' : 'No') : $value) }}
                        </p>
                    </div>
                @endif
            @endforeach
        </div>

        @if ($item->body)
            <div class="mt-6 border-t border-[#D6E0E8] pt-4">
                <p class="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">Body (markdown)</p>
                <pre class="mt-2 whitespace-pre-wrap rounded-lg bg-[#F7FAFC] p-4 font-mono text-[12px] leading-relaxed text-[#475467]">{{ $item->body }}</pre>
            </div>
        @endif
    </div>
@endsection
