@extends('securecrm.layouts.app')

@section('title', 'Notifications')
@section('crumb', 'SecureCRM')
@section('heading', 'Notifications')

@section('content')
    @if (session('status'))
        <div class="mb-5 rounded-xl border border-[#16A34A]/30 bg-[#16A34A]/10 px-4 py-3 text-[13px] font-semibold text-[#16A34A]">
            {{ session('status') }}
        </div>
    @endif

    <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-[13px] text-[#667085]">
            @if (auth('staff')->user()->unreadNotifications()->count() > 0)
                {{ auth('staff')->user()->unreadNotifications()->count() }} unread
            @else
                No unread notifications
            @endif
        </p>
        @if (auth('staff')->user()->unreadNotifications()->count() > 0)
            <form method="POST" action="{{ route('securecrm.notifications.read-all') }}">
                @csrf
                <button type="submit"
                    class="rounded-lg bg-[#102840] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1e3f61]">
                    Mark all read
                </button>
            </form>
        @endif
    </div>

    <div class="mt-5 space-y-3">
        @forelse ($notifications as $notification)
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-5">
                <div class="flex items-start justify-between gap-4">
                    <div class="flex min-w-0 flex-1 gap-3">
                        <span class="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full {{ $notification->read_at ? 'bg-[#D6E0E8]' : 'bg-[#38A8D8]' }}"></span>
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-2">
                                <p class="text-[13px] font-bold text-[#102840]">{{ $notification->data['title'] ?? 'Notification' }}</p>
                                @if (! $notification->read_at)
                                    <span class="rounded-md bg-[#38A8D8]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#2164b6]">new</span>
                                @endif
                            </div>
                            <p class="mt-1 text-[13px] text-[#667085]">{{ $notification->data['message'] ?? '' }}</p>
                            @if (! empty($notification->data['ticket_number']))
                                <p class="mt-1 text-[11px] font-semibold text-[#98A2B3]">{{ $notification->data['ticket_number'] }}</p>
                            @endif
                            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#98A2B3]">
                                <span>{{ $notification->created_at->diffForHumans() }}</span>
                                <span class="uppercase">{{ $notification->type }}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex shrink-0 flex-col items-end gap-2">
                        @if (! empty($notification->data['action_url']))
                            <a href="{{ $notification->data['action_url'] }}"
                                class="rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[12px] font-semibold text-[#2164b6] transition-colors hover:border-[#38A8D8]/50">
                                View
                            </a>
                        @endif
                        @if (! $notification->read_at)
                            <form method="POST" action="{{ route('securecrm.notifications.read', $notification->id) }}">
                                @csrf
                                <button type="submit"
                                    class="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#667085] transition-colors hover:bg-[#F0F5F8] hover:text-[#102840]">
                                    Mark read
                                </button>
                            </form>
                        @endif
                    </div>
                </div>
            </div>
        @empty
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-10 text-center">
                <p class="text-[14px] font-semibold text-[#102840]">You're all caught up</p>
                <p class="mt-1 text-[12px] text-[#667085]">Ticket updates and alerts will show up here.</p>
            </div>
        @endforelse
    </div>

    @if ($notifications->hasPages())
        <div class="mt-6">
            {{ $notifications->links() }}
        </div>
    @endif
@endsection
