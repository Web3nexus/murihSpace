@extends('securecrm.layouts.app')

@section('title', 'Help categories')
@section('crumb', 'SecureCRM / Content / Help Center')
@section('heading', 'Help categories')

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

    @if ($errors->any())
        <div class="mb-5 rounded-xl border border-[#DC2626]/30 bg-[#DC2626]/10 px-4 py-3">
            <ul class="list-disc space-y-1 pl-5 text-[13px] font-medium text-[#DC2626]">
                @foreach ($errors->all() as $error)
                    <li>{{ $error }}</li>
                @endforeach
            </ul>
        </div>
    @endif

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6 xl:col-span-2">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-[15px] font-bold text-[#102840]">Categories</h2>
                    <p class="mt-0.5 text-[12px] text-[#98A2B3]">Categories group articles on the public site. Disabled categories hide their articles from listings.</p>
                </div>
                <span class="rounded-full bg-[#102840]/5 px-3 py-1 text-[11px] font-bold text-[#102840]">{{ $categories->count() }} total</span>
            </div>

            <div class="mt-5 space-y-3">
                @forelse ($categories as $category)
                    <div class="rounded-xl border border-[#D6E0E8] p-4">
                        <div class="flex items-start justify-between gap-4">
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-[13px] font-bold text-[#102840]">{{ $category->name }}</p>
                                    <span class="rounded-md bg-[#2164b6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2164b6]">{{ $category->articles_count }} articles</span>
                                    @if ($category->featured)
                                        <span class="rounded-md bg-[#7C3AED]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7C3AED]">featured</span>
                                    @endif
                                    @if (! $category->is_active)
                                        <span class="rounded-md bg-[#F2D0D0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#B42318]">disabled</span>
                                    @endif
                                </div>
                                <p class="mt-1 text-[11px] text-[#98A2B3]">/help/{{ $category->slug }}</p>
                                @if ($category->blurb)
                                    <p class="mt-1 text-[12px] text-[#667085]">{{ $category->blurb }}</p>
                                @endif
                                @foreach ($category->children as $child)
                                    <p class="mt-1 text-[11px] text-[#98A2B3]">↳ {{ $child->name }} ({{ $child->articles_count }})</p>
                                @endforeach
                            </div>

                            <div class="flex shrink-0 items-center gap-2">
                                <form method="POST" action="{{ route('securecrm.help.categories.update', $category) }}">
                                    @csrf
                                    @method('PATCH')
                                    <input type="hidden" name="name" value="{{ $category->name }}">
                                    <input type="hidden" name="is_active" value="{{ $category->is_active ? '0' : '1' }}">
                                    <button type="submit"
                                            class="rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors
                                            {{ $category->is_active
                                                ? 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D] hover:bg-[#16A34A]/20'
                                                : 'border-[#D6E0E8] bg-[#F7FAFC] text-[#667085] hover:bg-[#102840]/5' }}">
                                        {{ $category->is_active ? 'Enabled' : 'Disabled' }}
                                    </button>
                                </form>
                                <form method="POST" action="{{ route('securecrm.help.categories.destroy', $category) }}"
                                      onsubmit="return confirm('Delete category “{{ $category->name }}”?')">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="rounded-lg border border-transparent px-3 py-1.5 text-[11px] font-bold text-[#DC2626] hover:bg-[#DC2626]/5">Delete</button>
                                </form>
                            </div>
                        </div>
                    </div>
                @empty
                    <p class="rounded-xl border border-dashed border-[#B7C6D1] px-4 py-8 text-center text-[13px] text-[#98A2B3]">
                        No categories yet.
                    </p>
                @endforelse
            </div>
        </div>

        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
            <h2 class="text-[15px] font-bold text-[#102840]">New category</h2>
            <form method="POST" action="{{ route('securecrm.help.categories.store') }}" class="mt-4 space-y-4">
                @csrf
                <div>
                    <label for="name" class="mb-1 block text-[12px] font-semibold text-[#102840]">Name</label>
                    <input id="name" type="text" name="name" required maxlength="120" value="{{ old('name') }}"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>
                <div>
                    <label for="slug" class="mb-1 block text-[12px] font-semibold text-[#102840]">Slug</label>
                    <input id="slug" type="text" name="slug" maxlength="120" value="{{ old('slug') }}" placeholder="auto-generated"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                </div>
                <div>
                    <label for="blurb" class="mb-1 block text-[12px] font-semibold text-[#102840]">Blurb</label>
                    <textarea id="blurb" name="blurb" rows="2" maxlength="500" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">{{ old('blurb') }}</textarea>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label for="parent_id" class="mb-1 block text-[12px] font-semibold text-[#102840]">Parent</label>
                        <select id="parent_id" name="parent_id" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                            <option value="">None</option>
                            @foreach ($categories as $candidate)
                                <option value="{{ $candidate->id }}">{{ $candidate->name }}</option>
                            @endforeach
                        </select>
                    </div>
                    <div>
                        <label for="sort_order" class="mb-1 block text-[12px] font-semibold text-[#102840]">Sort order</label>
                        <input id="sort_order" type="number" name="sort_order" min="0" value="{{ old('sort_order', 0) }}"
                               class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                        <input type="checkbox" name="featured" value="1" class="size-4 rounded border-[#D6E0E8] text-[#2164b6]"> Featured
                    </label>
                    <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                        <input type="checkbox" name="is_active" value="1" @checked(true) class="size-4 rounded border-[#D6E0E8] text-[#2164b6]"> Active
                    </label>
                </div>
                <button type="submit" class="w-full rounded-lg bg-[#2164b6] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">Create category</button>
            </form>
        </div>
    </div>
@endsection
