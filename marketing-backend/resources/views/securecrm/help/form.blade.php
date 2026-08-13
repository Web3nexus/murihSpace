@extends('securecrm.layouts.app')

@php $editing = $article !== null; @endphp
@section('title', $editing ? 'Edit article' : 'New article')
@section('crumb', 'SecureCRM / Content / Help Center')
@section('heading', $editing ? 'Edit article' : 'New article')

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
          action="{{ $editing ? route('securecrm.help.update', $article) : route('securecrm.help.store') }}"
          enctype="multipart/form-data"
          class="space-y-6">
        @csrf
        @if ($editing) @method('PATCH') @endif

        <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <!-- Main column -->
            <div class="space-y-6 xl:col-span-2">
                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <h2 class="text-[15px] font-bold text-[#102840]">Content</h2>

                    <div class="mt-4 space-y-4">
                        <div>
                            <label for="title" class="mb-1 block text-[12px] font-semibold text-[#102840]">Title</label>
                            <input id="title" type="text" name="title" required maxlength="255"
                                   value="{{ old('title', $editing ? $article->title : '') }}"
                                   placeholder="How to reset your password"
                                   class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                        </div>

                        <div>
                            <label for="slug" class="mb-1 block text-[12px] font-semibold text-[#102840]">Slug <span class="font-normal text-[#98A2B3]">(leave blank to auto-generate)</span></label>
                            <input id="slug" type="text" name="slug" maxlength="255"
                                   value="{{ old('slug', $editing ? $article->slug : '') }}"
                                   placeholder="how-to-reset-your-password"
                                   class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                            <p class="mt-1 text-[11px] text-[#98A2B3]">Public URL: {{ url('/help') }}/<span id="slug-preview" class="font-semibold text-[#2164b6]">{{ $editing ? $article->slug : 'your-slug' }}</span></p>
                        </div>

                        <div>
                            <label for="excerpt" class="mb-1 block text-[12px] font-semibold text-[#102840]">Excerpt</label>
                            <textarea id="excerpt" name="excerpt" rows="2" maxlength="1000"
                                      placeholder="One or two sentences shown in listings and search results."
                                      class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ old('excerpt', $editing ? $article->excerpt : '') }}</textarea>
                        </div>

                        <div>
                            <label for="category_id" class="mb-1 block text-[12px] font-semibold text-[#102840]">Category</label>
                            <select id="category_id" name="category_id" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                                <option value="">No category</option>
                                @foreach ($categories as $category)
                                    <option value="{{ $category->id }}" @selected(old('category_id', $editing ? $article->category_id : null) == $category->id)>{{ $category->name }}</option>
                                @endforeach
                            </select>
                        </div>

                        <div>
                            <label for="body" class="mb-1 block text-[12px] font-semibold text-[#102840]">Body <span class="font-normal text-[#98A2B3]">(markdown, optional)</span></label>
                            <textarea id="body" name="body" rows="10" placeholder="## Heading&#10;&#10;Paragraph text…"
                                      class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 font-mono text-[12px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ old('body', $editing ? $article->body : '') }}</textarea>
                        </div>
                    </div>
                </div>

                <!-- Sections repeater -->
                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <div class="flex items-center justify-between">
                        <div>
                            <h2 class="text-[15px] font-bold text-[#102840]">Sections</h2>
                            <p class="mt-0.5 text-[12px] text-[#98A2B3]">Structured sub-sections shown with an inline table of contents.</p>
                        </div>
                        <button type="button" onclick="addSection()" class="rounded-lg bg-[#102840] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#1e3f61]">+ Add section</button>
                    </div>

                    <div id="sections" class="mt-4 space-y-4">
                        @php
                            $sections = old('sections', $editing ? ($article->sections ?? []) : []);
                        @endphp
                        @foreach ($sections as $i => $section)
                            <div class="section-row rounded-xl border border-[#D6E0E8] p-4">
                                <div class="flex items-center gap-2">
                                    <input type="text" name="sections[{{ $i }}][heading]" value="{{ $section['heading'] ?? '' }}"
                                           placeholder="Section heading" maxlength="255"
                                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] font-bold text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]">
                                    <button type="button" onclick="this.closest('.section-row').remove()" class="shrink-0 rounded-lg border border-transparent px-2 py-1.5 text-[12px] font-bold text-[#DC2626] hover:bg-[#DC2626]/5">Remove</button>
                                </div>
                                <textarea name="sections[{{ $i }}][body]" rows="4"
                                          placeholder="Section body…"
                                          class="mt-2 w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]">{{ $section['body'] ?? '' }}</textarea>
                            </div>
                        @endforeach
                    </div>
                </div>

                <!-- SEO -->
                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <h2 class="text-[15px] font-bold text-[#102840]">SEO</h2>
                    <div class="mt-4 space-y-4">
                        <div>
                            <label for="seo_title" class="mb-1 block text-[12px] font-semibold text-[#102840]">SEO title <span class="font-normal text-[#98A2B3]">(max 160)</span></label>
                            <input id="seo_title" type="text" name="seo_title" maxlength="160"
                                   value="{{ old('seo_title', $editing ? $article->seo_title : '') }}"
                                   class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                        </div>
                        <div>
                            <label for="seo_description" class="mb-1 block text-[12px] font-semibold text-[#102840]">Meta description <span class="font-normal text-[#98A2B3]">(max 300)</span></label>
                            <textarea id="seo_description" name="seo_description" rows="2" maxlength="300"
                                      class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ old('seo_description', $editing ? $article->seo_description : '') }}</textarea>
                        </div>
                        <div>
                            <label for="canonical_url" class="mb-1 block text-[12px] font-semibold text-[#102840]">Canonical URL</label>
                            <input id="canonical_url" type="url" name="canonical_url" maxlength="500"
                                   value="{{ old('canonical_url', $editing ? $article->canonical_url : '') }}"
                                   class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sidebar column -->
            <div class="space-y-6">
                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <h2 class="text-[15px] font-bold text-[#102840]">Metadata</h2>
                    <div class="mt-4 space-y-4">
                        <div>
                            <label for="keywords_text" class="mb-1 block text-[12px] font-semibold text-[#102840]">Keywords</label>
                            <input id="keywords_text" type="text" name="keywords_text"
                                   value="{{ old('keywords_text', $editing && $article->keywords ? implode(', ', $article->keywords) : '') }}"
                                   placeholder="comma, separated"
                                   class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]">
                        </div>
                        <div>
                            <label for="tags_text" class="mb-1 block text-[12px] font-semibold text-[#102840]">Tags</label>
                            <input id="tags_text" type="text" name="tags_text"
                                   value="{{ old('tags_text', $editing && $article->tags ? implode(', ', $article->tags) : '') }}"
                                   placeholder="comma, separated"
                                   class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]">
                        </div>
                        <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                            <input type="checkbox" name="featured" value="1" @checked(old('featured', $editing ? $article->featured : false)) class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                            Featured article
                        </label>
                    </div>
                </div>

                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <h2 class="text-[15px] font-bold text-[#102840]">Related articles</h2>
                    <p class="mt-0.5 text-[12px] text-[#98A2B3]">Shown at the bottom of the public article.</p>
                    <div class="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                        @php $relatedIds = old('related', $editing ? $article->relatedArticles->pluck('id')->all() : []); @endphp
                        @foreach ($articles as $candidate)
                            <label class="flex items-start gap-2 rounded-lg border border-[#D6E0E8] px-3 py-2 text-[12px] font-medium text-[#475467] hover:bg-[#F7FAFC]">
                                <input type="checkbox" name="related[]" value="{{ $candidate->id }}"
                                       @checked(in_array($candidate->id, $relatedIds)) class="mt-0.5 size-3.5 rounded border-[#D6E0E8] text-[#2164b6]">
                                <span class="min-w-0">
                                    <span class="block truncate font-semibold text-[#102840]">{{ $candidate->title }}</span>
                                    <span class="block text-[11px] text-[#98A2B3]">{{ $candidate->category?->name ?? 'No category' }} · {{ $candidate->state }}</span>
                                </span>
                            </label>
                        @endforeach
                    </div>
                </div>

                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <h2 class="text-[15px] font-bold text-[#102840]">Revision note</h2>
                    <p class="mt-0.5 text-[12px] text-[#98A2B3]">What changed in this save? The previous version is kept as a recoverable revision.</p>
                    <textarea name="note" rows="2" maxlength="1000" placeholder="e.g. Rewrote troubleshooting steps"
                              class="mt-3 w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ old('note') }}</textarea>
                </div>

                <button type="submit"
                        class="w-full rounded-lg bg-[#2164b6] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
                    {{ $editing ? 'Save changes' : 'Create draft' }}
                </button>
                <a href="{{ $editing ? route('securecrm.help.show', $article) : route('securecrm.help') }}"
                   class="block rounded-lg border border-[#D6E0E8] px-4 py-2.5 text-center text-[13px] font-semibold text-[#667085] transition-colors hover:bg-[#F7FAFC]">Cancel</a>
            </div>
        </div>
    </form>

    <script>
        let sectionIndex = {{ (is_countable(old('sections', $editing ? ($article->sections ?? []) : [])) ? count(old('sections', $editing ? ($article->sections ?? []) : [])) : 0) }};

        function addSection() {
            const container = document.getElementById('sections');
            const row = document.createElement('div');
            row.className = 'section-row rounded-xl border border-[#D6E0E8] p-4';
            row.innerHTML = `
                <div class="flex items-center gap-2">
                    <input type="text" name="sections[${sectionIndex}][heading]" placeholder="Section heading" maxlength="255"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] font-bold text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]">
                    <button type="button" onclick="this.closest('.section-row').remove()" class="shrink-0 rounded-lg border border-transparent px-2 py-1.5 text-[12px] font-bold text-[#DC2626] hover:bg-[#DC2626]/5">Remove</button>
                </div>
                <textarea name="sections[${sectionIndex}][body]" rows="4" placeholder="Section body…"
                          class="mt-2 w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]"></textarea>
            `;
            container.appendChild(row);
            sectionIndex++;
        }

        document.getElementById('title')?.addEventListener('input', function () {
            const slugPreview = document.getElementById('slug-preview');
            const slugInput = document.getElementById('slug');
            if (slugPreview && document.activeElement !== slugInput) {
                slugPreview.textContent = slugify(this.value);
            }
        });

        function slugify(text) {
            return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }
    </script>
@endsection
