@extends('securecrm.layouts.app')

@section('title', 'Macros')
@section('crumb', 'SecureCRM / Operations')
@section('heading', 'Macros')

@section('content')
    @if (session('status'))
        <div class="mb-5 rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/10 px-4 py-3 text-[13px] font-semibold text-[#16A34A]">
            {{ session('status') }}
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
        <!-- Macro list -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6 xl:col-span-2">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-[15px] font-bold text-[#102840]">Canned replies &amp; macros</h2>
                    <p class="mt-0.5 text-[12px] text-[#98A2B3]">Reusable replies that can also change status, priority, tags, or the assigned team.</p>
                </div>
                <span class="rounded-full bg-[#102840]/5 px-3 py-1 text-[11px] font-bold text-[#102840]">{{ $macros->count() }} macro{{ $macros->count() === 1 ? '' : 's' }}</span>
            </div>

            <div class="mt-5 space-y-4">
                @forelse ($macros->groupBy('category') as $category => $items)
                    <div>
                        <h3 class="text-[11px] font-bold uppercase tracking-wider text-[#98A2B3]">{{ $category ?: 'General' }}</h3>
                        <div class="mt-2 divide-y divide-[#F0F5F8] rounded-xl border border-[#D6E0E8]">
                            @foreach ($items as $macro)
                                <div class="flex items-start justify-between gap-4 px-4 py-3">
                                    <div class="min-w-0">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-[13px] font-bold text-[#102840]">{{ $macro->name }}</p>
                                            @if (! $macro->is_active)
                                                <span class="rounded-md bg-[#F2D0D0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#B42318]">disabled</span>
                                            @endif
                                        </div>
                                        <p class="mt-0.5 text-[11px] font-semibold text-[#2164b6]">{{ $macro->actionSummary() }}</p>
                                        @if ($macro->body)
                                            <p class="mt-1 line-clamp-2 whitespace-pre-wrap text-[12px] leading-relaxed text-[#667085]">{{ $macro->body }}</p>
                                        @endif
                                        <p class="mt-1.5 text-[11px] text-[#98A2B3]">by {{ $macro->createdBy?->name ?? 'System' }}</p>
                                    </div>
                                    <div class="flex shrink-0 flex-col items-end gap-2">
                                        <form method="POST" action="{{ route('securecrm.macros.toggle', $macro) }}">
                                            @csrf
                                            <button type="submit"
                                                    class="rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors
                                                    {{ $macro->is_active
                                                        ? 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D] hover:bg-[#16A34A]/20'
                                                        : 'border-[#D6E0E8] bg-[#F7FAFC] text-[#667085] hover:bg-[#102840]/5' }}">
                                                {{ $macro->is_active ? 'Enabled' : 'Disabled' }}
                                            </button>
                                        </form>
                                        <div class="flex items-center gap-2">
                                            <a href="{{ route('securecrm.macros', ['edit' => $macro->id]) }}"
                                               class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[11px] font-bold text-[#2164b6] transition-colors hover:bg-[#2164b6]/5">Edit</a>
                                            <form method="POST" action="{{ route('securecrm.macros.destroy', $macro) }}"
                                                  onsubmit="return confirm('Delete macro “{{ $macro->name }}”?')">
                                                @csrf
                                                @method('DELETE')
                                                <button type="submit" class="rounded-lg border border-transparent px-3 py-1.5 text-[11px] font-bold text-[#DC2626] transition-colors hover:bg-[#DC2626]/5">Delete</button>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            @endforeach
                        </div>
                    </div>
                @empty
                    <p class="rounded-xl border border-dashed border-[#B7C6D1] px-4 py-8 text-center text-[13px] text-[#98A2B3]">
                        No macros yet — create your first canned reply or action macro.
                    </p>
                @endforelse
            </div>
        </div>

        <!-- Macro form -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
            @php
                $editing = $editMacro ?? null;
            @endphp
            <h2 class="text-[15px] font-bold text-[#102840]">{{ $editing ? 'Edit macro' : 'New macro' }}</h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">
                @if ($editing)
                    Update “{{ $editing->name }}”.
                @else
                    Compose a reply and optionally add safe actions.
                @endif
            </p>

            <form method="POST"
                  action="{{ $editing ? route('securecrm.macros.update', $editing) : route('securecrm.macros.store') }}"
                  class="mt-4 space-y-4">
                @csrf
                @if ($editing) @method('PATCH') @endif

                <div>
                    <label for="name" class="mb-1 block text-[12px] font-semibold text-[#102840]">Name</label>
                    <input id="name" type="text" name="name" value="{{ old('name', $editing?->name) }}" required maxlength="255"
                           placeholder="e.g. Payment confirmed"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>
                <div>
                    <label for="category" class="mb-1 block text-[12px] font-semibold text-[#102840]">Category</label>
                    <input id="category" type="text" name="category" value="{{ old('category', $editing?->category) }}" list="macro-categories" maxlength="120"
                           placeholder="e.g. Payments"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                    <datalist id="macro-categories">
                        @foreach ($categories as $category)
                            <option value="{{ $category }}"></option>
                        @endforeach
                    </datalist>
                </div>
                <div>
                    <label for="body" class="mb-1 block text-[12px] font-semibold text-[#102840]">Reply body <span class="font-normal text-[#98A2B3]">(optional)</span></label>
                    <textarea id="body" name="body" rows="5" maxlength="10000"
                              placeholder="Hi {name}, thanks for reaching out…"
                              class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] leading-relaxed text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ old('body', $editing?->body) }}</textarea>
                </div>

                <div>
                    <p class="text-[12px] font-bold text-[#102840]">Actions <span class="font-normal text-[#98A2B3]">(applied in order; each requires the same permission as doing it by hand)</span></p>
                    <div class="mt-2 space-y-2">
                        @foreach ([0, 1, 2, 3] as $i)
                            @php
                                $a = old("actions.{$i}", $editing?->actions[$i] ?? null);
                            @endphp
                            <div class="grid grid-cols-[1.2fr_1fr] gap-2 rounded-lg border border-[#F0F5F8] bg-[#F7FAFC] p-2">
                                <select name="actions[{{ $i }}][type]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                    <option value="">action…</option>
                                    @foreach ($actionTypes as $type)
                                        <option value="{{ $type }}" @selected(($a['type'] ?? '') === $type)>{{ str_replace('_', ' ', $type) }}</option>
                                    @endforeach
                                </select>

                                @if (($a['type'] ?? '') === 'change_status')
                                    <select name="actions[{{ $i }}][value]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                        <option value="">status…</option>
                                        @foreach ($statuses as $status)
                                            <option value="{{ $status }}" @selected((string) ($a['value'] ?? '') === $status)>{{ ucfirst(str_replace('_', ' ', $status)) }}</option>
                                        @endforeach
                                    </select>
                                @elseif (($a['type'] ?? '') === 'change_priority')
                                    <select name="actions[{{ $i }}][value]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                        <option value="">priority…</option>
                                        @foreach ($priorities as $priority)
                                            <option value="{{ $priority }}" @selected((string) ($a['value'] ?? '') === $priority)>{{ ucfirst($priority) }}</option>
                                        @endforeach
                                    </select>
                                @elseif (($a['type'] ?? '') === 'assign_team')
                                    <select name="actions[{{ $i }}][value]" class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                        <option value="">team…</option>
                                        @foreach ($teams as $team)
                                            <option value="{{ $team->id }}" @selected((string) ($a['value'] ?? '') === (string) $team->id)>{{ $team->name }}</option>
                                        @endforeach
                                    </select>
                                @elseif (($a['type'] ?? '') === 'insert_reply')
                                    <input type="text" name="actions[{{ $i }}][value]" value="{{ $a['value'] ?? '' }}"
                                           placeholder="reply text (or leave blank to use the body)"
                                           class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]">
                                @else
                                    <input type="text" name="actions[{{ $i }}][value]" value="{{ $a['value'] ?? '' }}"
                                           placeholder="value…"
                                           class="rounded-md border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]">
                                @endif
                            </div>
                        @endforeach
                    </div>
                </div>

                <div class="flex gap-3">
                    <button type="submit" class="flex-1 rounded-lg bg-[#2164b6] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
                        {{ $editing ? 'Save changes' : 'Save macro' }}
                    </button>
                    @if ($editing)
                        <a href="{{ route('securecrm.macros') }}" class="rounded-lg border border-[#D6E0E8] px-4 py-2.5 text-[13px] font-semibold text-[#667085] transition-colors hover:bg-[#F7FAFC]">Cancel</a>
                    @endif
                </div>
            </form>
        </div>
    </div>
@endsection
