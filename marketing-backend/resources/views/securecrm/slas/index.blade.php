@extends('securecrm.layouts.app')

@section('title', 'SLAs')
@section('crumb', 'SecureCRM / Operations')
@section('heading', 'SLAs')

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
        <!-- Policy list -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6 xl:col-span-2">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-[15px] font-bold text-[#102840]">Policies</h2>
                    <p class="mt-0.5 text-[12px] text-[#98A2B3]">Each priority maps to one active policy. Overtime is measured in countable hours (weekends/holidays/business-hours aware) and pauses while waiting on the customer when configured.</p>
                </div>
                <span class="rounded-full bg-[#102840]/5 px-3 py-1 text-[11px] font-bold text-[#102840]">{{ $policies->count() }} policy{{ $policies->count() === 1 ? '' : 's' }}</span>
            </div>

            <div class="mt-5 space-y-3">
                @forelse ($policies as $policy)
                    <div class="rounded-xl border border-[#D6E0E8] p-4">
                        <div class="flex items-start justify-between gap-4">
                            <div class="min-w-0 flex-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <p class="text-[13px] font-bold text-[#102840]">{{ $policy->name }}</p>
                                    <span class="rounded-md bg-[#2164b6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2164b6]">{{ $policy->priority }}</span>
                                    @if (! $policy->enabled)
                                        <span class="rounded-md bg-[#F2D0D0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#B42318]">disabled</span>
                                    @endif
                                </div>
                                @if ($policy->description)
                                    <p class="mt-1 text-[12px] leading-relaxed text-[#667085]">{{ $policy->description }}</p>
                                @endif

                                <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-[#475467]">
                                    <span><span class="font-bold">First response</span> {{ $policy->first_response_target }}m</span>
                                    @if ($policy->next_response_target) <span><span class="font-bold">Next</span> {{ $policy->next_response_target }}m</span>@endif
                                    <span><span class="font-bold">Resolve</span> {{ $policy->resolution_target }}m</span>
                                    <span><span class="font-bold">Clock</span> {{ $policy->business_hours ? 'business' : '24/7' }}
                                        {{ $policy->weekends ? '· weekends' : '' }}
                                        {{ $policy->holidays ? '· holidays paused' : '' }}</span>
                                    @if ($policy->pause_on_customer)
                                        <span class="font-bold text-[#9a6b00]">Pauses on customer</span>
                                    @endif
                                </div>
                            </div>

                            <div class="flex shrink-0 flex-col items-end gap-2">
                                <form method="POST" action="{{ route('securecrm.slas.toggle', $policy) }}">
                                    @csrf
                                    <button type="submit"
                                            class="rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors
                                            {{ $policy->enabled
                                                ? 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D] hover:bg-[#16A34A]/20'
                                                : 'border-[#D6E0E8] bg-[#F7FAFC] text-[#667085] hover:bg-[#102840]/5' }}">
                                        {{ $policy->enabled ? 'Enabled' : 'Disabled' }}
                                    </button>
                                </form>
                                <div class="flex items-center gap-2">
                                    <a href="{{ route('securecrm.slas', ['edit' => $policy->id]) }}"
                                       class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[11px] font-bold text-[#2164b6] transition-colors hover:bg-[#2164b6]/5">Edit</a>
                                    <form method="POST" action="{{ route('securecrm.slas.destroy', $policy) }}"
                                          onsubmit="return confirm('Delete SLA “{{ $policy->name }}”?')">
                                        @csrf
                                        @method('DELETE')
                                        <button type="submit" class="rounded-lg border border-transparent px-3 py-1.5 text-[11px] font-bold text-[#DC2626] transition-colors hover:bg-[#DC2626]/5">Delete</button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                @empty
                    <p class="rounded-xl border border-dashed border-[#B7C6D1] px-4 py-8 text-center text-[13px] text-[#98A2B3]">
                        No SLA policies yet — define your first service level.
                    </p>
                @endforelse
            </div>
        </div>

        <!-- Policy form -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
            @php $editing = $editPolicy ?? null; @endphp
            <h2 class="text-[15px] font-bold text-[#102840]">{{ $editing ? 'Edit policy' : 'New policy' }}</h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">{{ $editing ? 'Update “'.$editing->name.'”.' : 'Set the service level for a priority.' }}</p>

            <form method="POST"
                  action="{{ $editing ? route('securecrm.slas.update', $editing) : route('securecrm.slas.store') }}"
                  class="mt-5 space-y-4">
                @csrf
                @if ($editing) @method('PATCH') @endif

                <div>
                    <label for="name" class="mb-1 block text-[12px] font-semibold text-[#102840]">Name</label>
                    <input id="name" type="text" name="name" required maxlength="255"
                           value="{{ old('name', $editing?->name) }}"
                           placeholder="e.g. Critical — respond & resolve fast"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>
                <div>
                    <label for="description" class="mb-1 block text-[12px] font-semibold text-[#102840]">Description</label>
                    <input id="description" type="text" name="description" maxlength="2000"
                           value="{{ old('description', $editing?->description) }}"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>

                <div>
                    <label for="priority" class="mb-1 block text-[12px] font-semibold text-[#102840]">Applies to priority</label>
                    <select id="priority" name="priority" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                        @foreach ($priorities as $priority)
                            <option value="{{ $priority }}" @selected(old('priority', $editing?->priority) === $priority)>{{ ucfirst($priority) }}</option>
                        @endforeach
                    </select>
                </div>

                <div class="grid grid-cols-3 gap-3">
                    <div>
                        <label for="first_response_target" class="mb-1 block text-[12px] font-semibold text-[#102840]">First reply (min)</label>
                        <input id="first_response_target" type="number" name="first_response_target" required min="1"
                               value="{{ old('first_response_target', $editing?->first_response_target ?? 60) }}"
                               class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                    </div>
                    <div>
                        <label for="next_response_target" class="mb-1 block text-[12px] font-semibold text-[#102840]">Next (min)</label>
                        <input id="next_response_target" type="number" name="next_response_target" min="1"
                               value="{{ old('next_response_target', $editing?->next_response_target) }}"
                               class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                    </div>
                    <div>
                        <label for="resolution_target" class="mb-1 block text-[12px] font-semibold text-[#102840]">Resolve (min)</label>
                        <input id="resolution_target" type="number" name="resolution_target" required min="1"
                               value="{{ old('resolution_target', $editing?->resolution_target ?? 1440) }}"
                               class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-4">
                    <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                        <input type="checkbox" name="enabled" value="1" @checked(old('enabled', $editing ? $editing->enabled : true)) class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                        Enabled
                    </label>
                    <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                        <input type="checkbox" name="pause_on_customer" value="1" @checked(old('pause_on_customer', $editing?->pause_on_customer ?? false)) class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                        Pause while waiting on customer
                    </label>
                </div>

                <div class="flex flex-wrap items-center gap-4">
                    <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                        <input type="checkbox" name="business_hours" value="1" @checked(old('business_hours', $editing?->business_hours ?? false)) class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                        Business hours only
                    </label>
                    <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                        <input type="checkbox" name="weekends" value="1" @checked(old('weekends', $editing ? $editing->weekends : true)) class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                        Count weekends
                    </label>
                    <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                        <input type="checkbox" name="holidays" value="1" @checked(old('holidays', $editing?->holidays ?? false)) class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                        Pause on holidays
                    </label>
                </div>

                <div>
                    <label for="holiday_dates" class="mb-1 block text-[12px] font-semibold text-[#102840]">Holiday dates (Y-m-d, comma/newline separated)</label>
                    <input id="holiday_dates" type="text" name="holiday_dates"
                           value="{{ old('holiday_dates', $editing && $editing->holiday_dates ? implode(', ', $editing->holiday_dates) : '') }}"
                           placeholder="2026-12-25, 2026-01-01"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6]">
                </div>

                <div class="flex gap-3">
                    <button type="submit" class="flex-1 rounded-lg bg-[#2164b6] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
                        {{ $editing ? 'Save changes' : 'Create policy' }}
                    </button>
                    @if ($editing)
                        <a href="{{ route('securecrm.slas') }}" class="rounded-lg border border-[#D6E0E8] px-4 py-2.5 text-[13px] font-semibold text-[#667085] transition-colors hover:bg-[#F7FAFC]">Cancel</a>
                    @endif
                </div>
            </form>
        </div>
    </div>
@endsection