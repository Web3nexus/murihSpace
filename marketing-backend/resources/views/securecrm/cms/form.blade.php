@extends('securecrm.layouts.app')

@php $editing = $item !== null; @endphp
@section('title', $editing ? 'Edit content' : 'New content')
@section('crumb', 'SecureCRM / Content / Website CMS')
@section('heading', $editing ? 'Edit content' : 'New content')

@section('content')
    @if ($errors->any())
        <div class="mb-5 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/10 px-4 py-3">
            <ul class="list-disc space-y-1 pl-5 text-[13px] font-medium text-[#DC2626]">
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <form method="POST"
          action="{{ $editing
              ? route('securecrm.cms.update', ['cms' => $item, 'section' => $section])
              : route('securecrm.cms.store', ['section' => $section]) }}"
          class="space-y-6">
        @csrf
        @if ($editing) @method('PATCH') @endif

        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="text-[15px] font-bold text-[#102840]">{{ $definition['label'] }}</h2>
                    <p class="mt-0.5 text-[12px] text-[#98A2B3]">Editing within the "{{ $section }}" section.</p>
                </div>
                <span class="rounded-md bg-[#2164b6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2164b6]">{{ $definition['kind'] ?? 'collection' }}</span>
            </div>

            <div class="mt-5 space-y-4">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                        <label for="title" class="mb-1 block text-[12px] font-semibold text-[#102840]">Title <span class="font-normal text-[#98A2B3]">(used in the CMS list)</span></label>
                        <input id="title" type="text" name="title" maxlength="255"
                               value="{{ old('title', $editing ? $item->title : '') }}"
                               class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                    </div>
                    <div>
                        <label for="slug" class="mb-1 block text-[12px] font-semibold text-[#102840]">Slug <span class="font-normal text-[#98A2B3]">(leave blank to auto-generate)</span></label>
                        <input id="slug" type="text" name="slug" maxlength="255"
                               value="{{ old('slug', $editing ? $item->slug : '') }}"
                               class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                    </div>
                </div>

                <div>
                    <label for="sort_order" class="mb-1 block text-[12px] font-semibold text-[#102840]">Sort order <span class="font-normal text-[#98A2B3]">(lower first)</span></label>
                    <input id="sort_order" type="number" name="sort_order" min="0"
                           value="{{ old('sort_order', $editing ? $item->sort_order : 0) }}"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>

                <div>
                    <label for="excerpt" class="mb-1 block text-[12px] font-semibold text-[#102840]">Excerpt <span class="font-normal text-[#98A2B3]">(shown in listings)</span></label>
                    <textarea id="excerpt" name="excerpt" rows="2" maxlength="1000"
                              class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ old('excerpt', $editing ? $item->excerpt : '') }}</textarea>
                </div>
            </div>
        </div>

        @if ($definition['fields'] ?? [])
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h2 class="text-[15px] font-bold text-[#102840]">Content fields</h2>
                <p class="mt-0.5 text-[12px] text-[#98A2B3]">These are the values rendered on the public site for this {{ $definition['label'] }} item.</p>

                <div class="mt-4 space-y-4">
                    @php
                        $content = old('content', $editing ? ($item->content ?? []) : []);
                    @endphp
                    @foreach ($definition['fields'] as $field)
                        @php
                            $key = $field['key'];
                            $type = $field['type'] ?? 'text';
                            $value = $content[$key] ?? '';
                            $label = $field['label'];
                        @endphp
                        <div>
                            <label for="content-{{ $key }}" class="mb-1 block text-[12px] font-semibold text-[#102840]">{{ $label }}</label>
                            @if ($type === 'textarea' || $type === 'list')
                                <textarea id="content-{{ $key }}" name="content[{{ $key }}]" rows="{{ $type === 'list' ? 4 : 3 }}"
                                          placeholder="{{ $type === 'list' ? 'one item per line' : '' }}"
                                          class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ $type === 'list' ? (is_array($value) ? implode("\n", $value) : $value) : $value }}</textarea>
                            @elseif ($type === 'boolean')
                                <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                                    <input type="checkbox" name="content[{{ $key }}]" value="1"
                                           @checked((bool) $value) class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                                    {{ $label }}
                                </label>
                            @else
                                <input id="content-{{ $key }}" type="text" name="content[{{ $key }}]" maxlength="2000"
                                       value="{{ is_array($value) ? implode(', ', $value) : $value }}"
                                       class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                            @endif
                        </div>
                    @endforeach
                </div>
            </div>
        @endif

        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
            <h2 class="text-[15px] font-bold text-[#102840]">Body <span class="font-normal text-[#98A2B3]">(markdown, for blog/legal pages)</span></h2>
            <textarea name="body" rows="8" placeholder="## Heading&#10;&#10;Paragraph text…"
                      class="mt-3 w-full rounded-lg border border-[#D6E0E8] px-3 py-2 font-mono text-[12px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ old('body', $editing ? $item->body : '') }}</textarea>
        </div>

        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
            <h2 class="text-[15px] font-bold text-[#102840]">SEO</h2>
            <div class="mt-4 space-y-4">
                <div>
                    <label for="seo_title" class="mb-1 block text-[12px] font-semibold text-[#102840]">SEO title <span class="font-normal text-[#98A2B3]">(max 160)</span></label>
                    <input id="seo_title" type="text" name="seo_title" maxlength="160"
                           value="{{ old('seo_title', $editing ? $item->seo_title : '') }}"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>
                <div>
                    <label for="seo_description" class="mb-1 block text-[12px] font-semibold text-[#102840]">Meta description <span class="font-normal text-[#98A2B3]">(max 300)</span></label>
                    <textarea id="seo_description" name="seo_description" rows="2" maxlength="300"
                              class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ old('seo_description', $editing ? $item->seo_description : '') }}</textarea>
                </div>
            </div>
        </div>

        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
            <h2 class="text-[15px] font-bold text-[#102840]">Revision note</h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">What changed in this save? The previous version is kept as a recoverable revision.</p>
            <textarea name="note" rows="2" maxlength="1000" placeholder="e.g. Updated homepage headline"
                      class="mt-3 w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ old('note') }}</textarea>
        </div>

        <div class="flex gap-3">
            <button type="submit"
                    class="rounded-lg bg-[#2164b6] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
                {{ $editing ? 'Save changes' : 'Create draft' }}
            </button>
            <a href="{{ route('securecrm.cms', ['section' => $section]) }}"
               class="rounded-lg border border-[#D6E0E8] px-5 py-2.5 text-[13px] font-semibold text-[#667085] transition-colors hover:bg-[#F7FAFC]">Cancel</a>
        </div>
    </form>
@endsection
