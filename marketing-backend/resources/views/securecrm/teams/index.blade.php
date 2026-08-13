@extends('securecrm.layouts.app')

@section('title', 'Teams')
@section('crumb', 'SecureCRM / Operations')
@section('heading', 'Teams')

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

    <div class="mb-5 flex items-center gap-3 rounded-2xl border border-[#D6E0E8] bg-white p-4">
        <span class="rounded-full bg-[#F0F5F8] px-3 py-1 text-[11px] font-bold text-[#667085]">{{ $teams->count() }} teams</span>
        <span class="rounded-full bg-[#F0F5F8] px-3 py-1 text-[11px] font-bold text-[#667085]">{{ $unassigned }} unassigned open</span>
        <a href="{{ route('securecrm.tickets') }}" class="ml-auto text-[12px] font-semibold text-[#2164b6] hover:text-[#1b52a0]">Open ticket inbox →</a>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <!-- Team list -->
        <div class="space-y-4 xl:col-span-2">
            @forelse ($teams as $team)
                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
                    <div class="flex items-start justify-between gap-4">
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="text-[14px] font-bold text-[#102840]">{{ $team->name }}</p>
                                @if (! $team->is_active)
                                    <span class="rounded-md bg-[#F2D0D0] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#B42318]">disabled</span>
                                @endif
                                <span class="rounded-md bg-[#2164b6]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2164b6]">{{ $team->members_count }} member{{ $team->members_count === 1 ? '' : 's' }}</span>
                            </div>
                            @if ($team->description)
                                <p class="mt-1 text-[12px] leading-relaxed text-[#667085]">{{ $team->description }}</p>
                            @endif

                            <div class="mt-3 flex flex-wrap gap-1.5">
                                @forelse ($team->members as $member)
                                    <span class="inline-flex items-center gap-1.5 rounded-full border border-[#D6E0E8] bg-[#F7FAFC] px-2.5 py-0.5 text-[11px] font-medium text-[#475467]">
                                        {{ $member->name }}
                                        @if ($member->pivot->is_lead)
                                            <span class="font-bold text-[#9a6b00]">· lead</span>
                                        @endif
                                        @if (! $member->is_available)
                                            <span class="size-1.5 rounded-full bg-[#DC2626]" title="Unavailable"></span>
                                        @endif
                                    </span>
                                @empty
                                    <span class="text-[12px] text-[#98A2B3]">No members yet.</span>
                                @endforelse
                            </div>
                        </div>

                        <div class="flex shrink-0 flex-col items-end gap-2">
                            <div class="flex items-center gap-2">
                                <a href="{{ $routes['queue']($team) }}" class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[11px] font-bold text-[#2164b6] transition-colors hover:bg-[#2164b6]/5">
                                    Queue ({{ $team->open_tickets_count }})
                                </a>
                                <a href="{{ route('securecrm.teams', ['edit' => $team->id]) }}" class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[11px] font-bold text-[#2164b6] transition-colors hover:bg-[#2164b6]/5">Edit</a>
                                <form method="POST" action="{{ $routes['toggle']($team) }}">
                                    @csrf
                                    <button type="submit" class="rounded-lg border px-3 py-1.5 text-[11px] font-bold transition-colors
                                        {{ $team->is_active
                                            ? 'border-[#16A34A]/30 bg-[#16A34A]/10 text-[#15803D] hover:bg-[#16A34A]/20'
                                            : 'border-[#D6E0E8] bg-[#F7FAFC] text-[#667085] hover:bg-[#102840]/5' }}">
                                        {{ $team->is_active ? 'Enabled' : 'Disabled' }}
                                    </button>
                                </form>
                                <form method="POST" action="{{ $routes['destroy']($team) }}" onsubmit="return confirm('Delete team “{{ $team->name }}”? Tickets keep their team assignment.')">
                                    @csrf
                                    @method('DELETE')
                                    <button type="submit" class="rounded-lg border border-transparent px-3 py-1.5 text-[11px] font-bold text-[#DC2626] transition-colors hover:bg-[#DC2626]/5">Delete</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            @empty
                <p class="rounded-2xl border border-dashed border-[#B7C6D1] px-4 py-10 text-center text-[13px] text-[#98A2B3]">
                    No support teams yet — create one to route tickets and balance agent load.
                </p>
            @endforelse
        </div>

        <!-- Team form -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
            @php
                $editing = $teams->firstWhere('id', request()->integer('edit'));
            @endphp
            <h2 class="text-[15px] font-bold text-[#102840]">{{ $editing ? 'Edit team' : 'New team' }}</h2>
            <p class="mt-0.5 text-[12px] text-[#98A2B3]">{{ $editing ? 'Update “'.$editing->name.'”.' : 'Group agents, then route tickets to the team.' }}</p>

            <form method="POST" action="{{ $editing ? $routes['update']($editing) : $routes['store'] }}" class="mt-5 space-y-4">
                @csrf
                @if ($editing) @method('PATCH') @endif

                <div>
                    <label for="name" class="mb-1 block text-[12px] font-semibold text-[#102840]">Name</label>
                    <input id="name" type="text" name="name" required maxlength="255"
                           value="{{ old('name', $editing?->name) }}"
                           placeholder="e.g. Billing"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>
                <div>
                    <label for="description" class="mb-1 block text-[12px] font-semibold text-[#102840]">Description</label>
                    <input id="description" type="text" name="description" maxlength="2000"
                           value="{{ old('description', $editing?->description) }}"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>

                <div>
                    <label class="mb-1 block text-[12px] font-semibold text-[#102840]">Members</label>
                    <div class="max-h-56 space-y-1.5 overflow-y-auto rounded-lg border border-[#D6E0E8] p-3">
                        @php
                            $oldMemberIds = old('member_ids', $editing?->members->pluck('id')->all() ?? []);
                            $oldLeadIds = old('lead_ids', $editing && $editing->members
                                ? $editing->members->where('pivot.is_lead', true)->pluck('id')->all()
                                : []);
                        @endphp
                        @forelse ($agents as $agent)
                            <label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-[#F7FAFC]">
                                <input type="checkbox" name="member_ids[]" value="{{ $agent->id }}" @checked(in_array($agent->id, $oldMemberIds, true))
                                       class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                                <span class="flex-1">
                                    <span class="font-medium text-[#102840]">{{ $agent->name }}</span>
                                    <span class="ml-2 text-[11px] text-[#98A2B3]">{{ $agent->role }}</span>
                                </span>
                                <label class="flex items-center gap-1 text-[11px] font-semibold text-[#667085]">
                                    <input type="checkbox" name="lead_ids[]" value="{{ $agent->id }}" @checked(in_array($agent->id, $oldLeadIds, true))
                                           class="size-3.5 rounded border-[#D6E0E8] text-[#9a6b00]">
                                    lead
                                </label>
                            </label>
                        @empty
                            <p class="text-[12px] text-[#98A2B3]">No active agents available.</p>
                        @endforelse
                    </div>
                </div>

                <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                    <input type="checkbox" name="is_active" value="1" @checked(old('is_active', $editing ? $editing->is_active : true)) class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                    Enabled
                </label>

                <div class="flex gap-3">
                    <button type="submit" class="flex-1 rounded-lg bg-[#2164b6] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
                        {{ $editing ? 'Save changes' : 'Create team' }}
                    </button>
                    @if ($editing)
                        <a href="{{ route('securecrm.teams') }}" class="rounded-lg border border-[#D6E0E8] px-4 py-2.5 text-[13px] font-semibold text-[#667085] transition-colors hover:bg-[#F7FAFC]">Cancel</a>
                    @endif
                </div>
            </form>
        </div>
    </div>

    <!-- Agent availability -->
    <div class="mt-6 rounded-2xl border border-[#D6E0E8] bg-white p-6">
        <div class="flex items-center justify-between">
            <div>
                <h2 class="text-[15px] font-bold text-[#102840]">Agent availability</h2>
                <p class="mt-0.5 text-[12px] text-[#98A2B3]">Only available agents are picked by load-balanced assignment.</p>
            </div>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            @forelse ($agents as $agent)
                <div class="flex items-center justify-between rounded-xl border border-[#D6E0E8] px-3 py-2.5">
                    <div class="min-w-0">
                        <p class="truncate text-[13px] font-semibold text-[#102840]">{{ $agent->name }}</p>
                        <p class="truncate text-[11px] text-[#98A2B3]">{{ $agent->role }}</p>
                    </div>
                    <form method="POST" action="{{ route('securecrm.teams.availability', $agent) }}">
                        @csrf
                        @method('PATCH')
                        <button type="submit"
                                class="rounded-full px-3 py-1 text-[11px] font-bold transition-colors
                                {{ $agent->is_available
                                    ? 'bg-[#16A34A]/10 text-[#15803D] hover:bg-[#16A34A]/20'
                                    : 'bg-[#DC2626]/10 text-[#DC2626] hover:bg-[#DC2626]/20' }}">
                            {{ $agent->is_available ? 'Available' : 'Unavailable' }}
                        </button>
                    </form>
                </div>
            @empty
                <p class="text-[12px] text-[#98A2B3]">No active agents.</p>
            @endforelse
        </div>
    </div>
@endsection