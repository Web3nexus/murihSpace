@extends('securecrm.layouts.app')

@php $editing = $announcement !== null; @endphp
@section('title', $editing ? 'Edit announcement' : 'New announcement')
@section('crumb', 'SecureCRM / Content / Announcements')
@section('heading', $editing ? 'Edit announcement' : 'New announcement')

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

    @if ($editing)
        <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide
                {{ $announcement->state === 'published' ? 'bg-[#16A34A]/10 text-[#15803D]'
                    : ($announcement->state === 'scheduled' ? 'bg-[#9a6b00]/10 text-[#9a6b00]'
                    : ($announcement->state === 'archived' ? 'bg-[#F2D0D0] text-[#B42318]'
                    : 'bg-[#F59E0B]/10 text-[#9a5b00]')) }}">
                {{ $announcement->state }}
            </span>
            @if ($announcement->state !== 'archived' && $announcement->state !== 'published')
                <form method="POST" action="{{ route('securecrm.announcements.publish', $announcement) }}">
                    @csrf
                    <button type="submit" class="rounded-lg bg-[#16A34A] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#15803D]">Publish</button>
                </form>
            @endif
            @if ($announcement->state === 'published')
                <form method="POST" action="{{ route('securecrm.announcements.unpublish', $announcement) }}">
                    @csrf
                    <button type="submit" class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[12px] font-semibold text-[#667085] hover:bg-[#F7FAFC]">Unpublish</button>
                </form>
            @endif
            <details class="group">
                <summary class="cursor-pointer list-none rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[12px] font-semibold text-[#667085] hover:bg-[#F7FAFC]">Schedule…</summary>
                <form method="POST" action="{{ route('securecrm.announcements.schedule', $announcement) }}" class="mt-2 flex items-center gap-2">
                    @csrf
                    <input type="datetime-local" name="scheduled_at" required class="rounded-lg border border-[#D6E0E8] px-2 py-1.5 text-[12px] text-[#102840]">
                    <button type="submit" class="rounded-lg bg-[#102840] px-3 py-1.5 text-[12px] font-semibold text-white">Schedule</button>
                </form>
            </details>
            @if ($announcement->state === 'archived')
                <form method="POST" action="{{ route('securecrm.announcements.restore', $announcement) }}">
                    @csrf
                    <button type="submit" class="rounded-lg bg-[#102840] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#1e3f61]">Restore</button>
                </form>
            @else
                <form method="POST" action="{{ route('securecrm.announcements.archive', $announcement) }}">
                    @csrf
                    <button type="submit" class="rounded-lg border border-[#DC2626]/30 px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#DC2626]/5">Archive</button>
                </form>
            @endif
            <form method="POST" action="{{ route('securecrm.announcements.destroy', $announcement) }}" onsubmit="return confirm('Delete this announcement permanently?')">
                @csrf
                @method('DELETE')
                <button type="submit" class="rounded-lg border border-[#DC2626]/30 px-3 py-1.5 text-[12px] font-semibold text-[#DC2626] hover:bg-[#DC2626]/5">Delete</button>
            </form>
        </div>
    @endif

    <form method="POST"
          action="{{ $editing ? route('securecrm.announcements.update', $announcement) : route('securecrm.announcements.store') }}"
          class="mt-5 space-y-6">
        @csrf
        @if ($editing) @method('PATCH') @endif

        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
            <h2 class="text-[15px] font-bold text-[#102840]">Announcement</h2>
            <div class="mt-4 space-y-4">
                <div>
                    <label for="title" class="mb-1 block text-[12px] font-semibold text-[#102840]">Title</label>
                    <input id="title" type="text" name="title" required maxlength="255"
                           value="{{ old('title', $editing ? $announcement->title : '') }}"
                           class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
                </div>
                <div>
                    <label for="body" class="mb-1 block text-[12px] font-semibold text-[#102840]">Message <span class="font-normal text-[#98A2B3]">(markdown, optional)</span></label>
                    <textarea id="body" name="body" rows="6"
                              class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">{{ old('body', $editing ? $announcement->body : '') }}</textarea>
                </div>
                <label class="flex items-center gap-2 text-[12px] font-semibold text-[#102840]">
                    <input type="checkbox" name="featured" value="1" @checked(old('featured', $editing ? $announcement->featured : false)) class="size-4 rounded border-[#D6E0E8] text-[#2164b6]">
                    Featured announcement
                </label>
            </div>
        </div>

        <div class="flex gap-3">
            <button type="submit"
                    class="rounded-lg bg-[#2164b6] px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
                {{ $editing ? 'Save changes' : 'Create draft' }}
            </button>
            <a href="{{ route('securecrm.announcements') }}"
               class="rounded-lg border border-[#D6E0E8] px-5 py-2.5 text-[13px] font-semibold text-[#667085] transition-colors hover:bg-[#F7FAFC]">Cancel</a>
        </div>
    </form>
@endsection
