@extends('securecrm.layouts.app')

@section('title', 'New Ticket')
@section('crumb', 'SecureCRM / Support / Tickets')
@section('heading', 'New Ticket')

@section('content')
    @if (session('status'))
        <div class="mb-5 rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/10 px-4 py-3 text-[13px] font-semibold text-[#16A34A]">
            {{ session('status') }}
        </div>
    @endif

    <form method="POST" action="{{ route('securecrm.tickets.store') }}" class="max-w-3xl rounded-2xl border border-[#D6E0E8] bg-white p-6">
        @csrf

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div class="sm:col-span-2">
                <label for="subject" class="mb-1.5 block text-[13px] font-semibold text-[#102840]">Subject</label>
                <input id="subject" type="text" name="subject" value="{{ old('subject') }}" required maxlength="255"
                       placeholder="Brief summary of the issue"
                       class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2.5 text-[14px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15 @error('subject') border-[#DC2626] @enderror">
                @error('subject')
                    <p class="mt-1 text-[12px] font-medium text-[#DC2626]">{{ $message }}</p>
                @enderror
            </div>

            <div>
                <label for="category_id" class="mb-1.5 block text-[13px] font-semibold text-[#102840]">Category</label>
                <select id="category_id" name="category_id" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2.5 text-[14px] text-[#102840] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                    <option value="">— Select category —</option>
                    @foreach ($categories as $category)
                        <option value="{{ $category->id }}" @selected(old('category_id') == $category->id)>{{ $category->name }}</option>
                        @foreach ($category->children as $child)
                            <option value="{{ $child->id }}" @selected(old('category_id') == $child->id)>&nbsp;&nbsp;↳ {{ $child->name }}</option>
                        @endforeach
                    @endforeach
                </select>
                @error('category_id')
                    <p class="mt-1 text-[12px] font-medium text-[#DC2626]">{{ $message }}</p>
                @enderror
            </div>

            <div>
                <label for="priority" class="mb-1.5 block text-[13px] font-semibold text-[#102840]">Priority</label>
                <select id="priority" name="priority" required class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2.5 text-[14px] text-[#102840] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                    @foreach ($priorities as $priority)
                        <option value="{{ $priority }}" @selected(old('priority', 'normal') === $priority)>{{ ucfirst($priority) }}</option>
                    @endforeach
                </select>
                @error('priority')
                    <p class="mt-1 text-[12px] font-medium text-[#DC2626]">{{ $message }}</p>
                @enderror
            </div>

            <div class="sm:col-span-2">
                <label for="assigned_agent_id" class="mb-1.5 block text-[13px] font-semibold text-[#102840]">Assign to</label>
                <select id="assigned_agent_id" name="assigned_agent_id" class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2.5 text-[14px] text-[#102840] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                    <option value="">— Unassigned —</option>
                    @foreach ($agents as $agent)
                        <option value="{{ $agent->id }}" @selected(old('assigned_agent_id') == $agent->id)>{{ $agent->name }}</option>
                    @endforeach
                </select>
                @error('assigned_agent_id')
                    <p class="mt-1 text-[12px] font-medium text-[#DC2626]">{{ $message }}</p>
                @enderror
            </div>

            <div class="sm:col-span-2">
                <label for="description" class="mb-1.5 block text-[13px] font-semibold text-[#102840]">Description</label>
                <textarea id="description" name="description" rows="7" required maxlength="10000"
                          placeholder="Describe the issue in detail…"
                          class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2.5 text-[14px] leading-relaxed text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15 @error('description') border-[#DC2626] @enderror">{{ old('description') }}</textarea>
                @error('description')
                    <p class="mt-1 text-[12px] font-medium text-[#DC2626]">{{ $message }}</p>
                @enderror
            </div>
        </div>

        <div class="mt-6 flex items-center justify-end gap-3 border-t border-[#F0F5F8] pt-5">
            <a href="{{ route('securecrm.tickets') }}" class="rounded-lg border border-[#D6E0E8] px-4 py-2 text-[13px] font-semibold text-[#667085] transition-colors hover:border-[#38A8D8]/50 hover:text-[#2164b6]">
                Cancel
            </a>
            <button type="submit" class="inline-flex items-center gap-2 rounded-lg bg-[#2164b6] px-5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
                Create ticket
            </button>
        </div>
    </form>
@endsection
