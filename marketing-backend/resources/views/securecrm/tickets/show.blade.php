@extends('securecrm.layouts.app')

@section('title', $ticket->ticket_number)
@section('crumb', 'SecureCRM / Support / Tickets')
@section('heading', $ticket->ticket_number)

@section('content')
    <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
            @php
                $statusStyles = [
                    'new' => 'bg-[#2164b6]/10 text-[#2164b6]',
                    'open' => 'bg-[#38A8D8]/10 text-[#1f7aa8]',
                    'pending_customer' => 'bg-[#F59E0B]/10 text-[#B45309]',
                    'pending_internal' => 'bg-[#F59E0B]/10 text-[#B45309]',
                    'escalated' => 'bg-[#DC2626]/10 text-[#DC2626]',
                    'resolved' => 'bg-[#16A34A]/10 text-[#16A34A]',
                    'closed' => 'bg-[#98A2B3]/10 text-[#667085]',
                    'reopened' => 'bg-[#EA580C]/10 text-[#EA580C]',
                ];
                $priorityStyles = [
                    'critical' => 'bg-[#DC2626]/10 text-[#DC2626]',
                    'urgent' => 'bg-[#EA580C]/10 text-[#EA580C]',
                    'high' => 'bg-[#F59E0B]/10 text-[#B45309]',
                    'normal' => 'bg-[#38A8D8]/10 text-[#2164b6]',
                    'low' => 'bg-[#98A2B3]/10 text-[#667085]',
                ];
            @endphp
            <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $statusStyles[$ticket->status] ?? 'bg-[#F0F5F8] text-[#667085]' }}">{{ $ticket->statusLabel() }}</span>
            <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $priorityStyles[$ticket->priority] ?? 'bg-[#F0F5F8] text-[#667085]' }}">{{ $ticket->priorityLabel() }}</span>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-[#D6E0E8] bg-[#F7FAFC] px-2.5 py-0.5 text-[11px] font-semibold text-[#667085]">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 3v18M16 3v18M3 8h18M3 16h18"/></svg>
                {{ str_replace('_', ' ', ucfirst($ticket->channel)) }}
            </span>
        </div>
        <a href="{{ route('securecrm.tickets') }}" class="text-[13px] font-semibold text-[#2164b6] hover:text-[#1b52a0]">← Back to tickets</a>
    </div>

    <div class="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <!-- Description -->
        <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6 xl:col-span-2">
            <h2 class="text-lg font-bold tracking-tight text-[#102840]">{{ $ticket->subject }}</h2>
            <div class="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-[#334155]">{{ $ticket->description }}</div>

            @if ($ticket->attachments->isNotEmpty())
                <div class="mt-4 flex flex-wrap gap-2">
                    @foreach ($ticket->attachments as $attachment)
                        <span class="inline-flex items-center gap-1.5 rounded-lg border border-[#D6E0E8] bg-[#F7FAFC] px-3 py-1.5 text-[12px] font-medium text-[#667085]">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3.5"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                            {{ $attachment->original_name }}
                        </span>
                    @endforeach
                </div>
            @endif

            @if (! empty($ticket->context))
                <div class="mt-5 rounded-xl border border-[#D6E0E8] bg-[#F7FAFC] p-4">
                    <h3 class="text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">Visitor context</h3>
                    <dl class="mt-3 space-y-2 text-[13px]">
                        @foreach ([
                            'Search query' => $ticket->context['search_query'] ?? null,
                            'Attempted article' => $ticket->context['attempted_article'] ?? null,
                            'Current page' => $ticket->context['current_page'] ?? null,
                            'User ID' => isset($ticket->context['user_id']) ? '#' . $ticket->context['user_id'] : null,
                            'Device' => $ticket->context['device'] ?? null,
                            'User agent' => $ticket->context['user_agent'] ?? null,
                            'IP address' => $ticket->context['ip_address'] ?? null,
                        ] as $label => $value)
                            @if ($value !== null && $value !== '')
                                <div class="flex items-start justify-between gap-4">
                                    <dt class="shrink-0 text-[#98A2B3]">{{ $label }}</dt>
                                    <dd class="break-all text-right font-semibold text-[#334155]">{{ $value }}</dd>
                                </div>
                            @endif
                        @endforeach
                    </dl>
                </div>
            @endif

            <!-- Conversation thread -->
            <div class="mt-6 border-t border-[#F0F5F8] pt-6">
                <div class="flex items-center justify-between">
                    <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Conversation</h3>
                    <span class="rounded-full bg-[#F0F5F8] px-2.5 py-0.5 text-[11px] font-bold text-[#667085]">{{ $ticket->messages->count() }} messages</span>
                </div>

                <div class="mt-4 space-y-4">
                    @php
                        $authorInitials = fn ($name) => strtoupper(Str::substr($name ?? '?', 0, 2));
                    @endphp

                    @foreach ($ticket->messages as $message)
                        @if ($message->isInternal())
                            {{-- Internal note / system event --}}
                            <div class="rounded-xl border border-[#F59E0B]/25 bg-[#FFFBEB] px-4 py-3">
                                <div class="flex items-center justify-between gap-3">
                                    <div class="flex items-center gap-2">
                                        <span class="flex h-6 w-6 items-center justify-center rounded-full bg-[#F59E0B]/15 text-[10px] font-bold text-[#B45309]">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3"><path d="m10 20-2 1m8-5a7.4 7.4 0 0 0 .05-2.5l1.02-5.9a3.4 3.4 0 0 0-6.75-1l-.47 2.7"/><path d="m4.03 16.86-1.01 5.14 5.13-1.01"/><path d="M8.04 16.86 4.06 12.9a2.28 2.28 0 0 1 3.2-3.2l4.98 4.98"/></svg>
                                        </span>
                                        <span class="text-[12px] font-bold uppercase tracking-wide text-[#B45309]">
                                            {{ $message->type === 'internal_note' ? 'Internal note' : 'System' }}
                                        </span>
                                    </div>
                                    <span class="text-[11px] text-[#98A2B3]">{{ $message->created_at->diffForHumans() }}</span>
                                </div>
                                <p class="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[#667085]">{{ $message->body }}</p>
                            </div>
                        @else
                            {{-- Customer message / agent reply --}}
                            @php
                                $isAgent = $message->type === 'reply';
                                $authorName = $isAgent ? ($message->staffUser?->name ?? 'Support Team') : ($message->user?->name ?? 'Customer');
                                $initials = $isAgent ? $authorInitials($message->staffUser?->name ?? 'ST') : $authorInitials($message->user?->name ?? 'CU');
                            @endphp
                            <div class="flex gap-3">
                                <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold {{ $isAgent ? 'bg-[#2164b6] text-white' : 'bg-[#102840] text-white' }}">
                                    {{ $initials }}
                                </span>
                                <div class="min-w-0 flex-1 rounded-xl border border-[#D6E0E8] bg-white px-4 py-3">
                                    <div class="flex items-center justify-between gap-3">
                                        <div class="flex items-center gap-2">
                                            <span class="text-[13px] font-bold text-[#102840]">{{ $authorName }}</span>
                                            <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide {{ $isAgent ? 'bg-[#2164b6]/10 text-[#2164b6]' : 'bg-[#F0F5F8] text-[#667085]' }}">
                                                {{ $isAgent ? 'Agent' : 'Customer' }}
                                            </span>
                                        </div>
                                        <span class="shrink-0 text-[11px] text-[#98A2B3]">{{ $message->created_at->format('M j, Y g:i A') }}</span>
                                    </div>
                                    <p class="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#334155]">{{ $message->body }}</p>
                                    @if ($message->attachments->isNotEmpty())
                                        <div class="mt-3 flex flex-wrap gap-2 border-t border-[#F0F5F8] pt-3">
                                            @foreach ($message->attachments as $attachment)
                                                <span class="inline-flex items-center gap-1.5 rounded-lg bg-[#F0F5F8] px-2.5 py-1 text-[11px] font-medium text-[#667085]">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                                                    {{ $attachment->original_name }}
                                                </span>
                                            @endforeach
                                        </div>
                                    @endif
                                </div>
                            </div>
                        @endif
                    @endforeach

                    @if ($ticket->events->isNotEmpty())
                        <div class="mt-2 space-y-2 border-t border-dashed border-[#D6E0E8] pt-4">
                            @foreach ($ticket->events as $event)
                                <p class="flex flex-wrap items-center gap-x-2 text-[12px] text-[#98A2B3]">
                                    <span class="font-semibold text-[#667085]">{{ $event->staffUser?->name ?? 'System' }}</span>
                                    @switch($event->event)
                                        @case('created')
                                            created the ticket
                                            @break
                                        @case('status_changed')
                                            changed status from <span class="font-semibold text-[#667085]">{{ str_replace('_', ' ', $event->old_value ?? '—') }}</span> to <span class="font-semibold text-[#667085]">{{ str_replace('_', ' ', $event->new_value) }}</span>
                                            @break
                                        @case('escalated')
                                            escalated the ticket
                                            @break
                                        @case('assigned')
                                            {{ $event->new_value ? 'assigned the ticket' : 'unassigned the ticket' }}
                                            @break
                                        @case('note_added')
                                            added an internal note
                                            @break
                                        @case('macro_applied')
                                            applied macro <span class="font-semibold text-[#667085]">{{ $event->new_value }}</span>
                                            @break
                                        @case('priority_changed')
                                            changed priority from <span class="font-semibold text-[#667085]">{{ $event->old_value ?? '—' }}</span> to <span class="font-semibold text-[#667085]">{{ $event->new_value }}</span>
                                            @break
                                        @case('resolved')
                                            marked the ticket as resolved
                                            @break
                                        @case('closed')
                                            closed the ticket
                                            @break
                                        @case('reopened')
                                            reopened the ticket
                                            @break
                                        @default
                                            {{ str_replace('_', ' ', $event->event) }}
                                    @endswitch
                                    <span class="ml-auto shrink-0">{{ $event->created_at->diffForHumans() }}</span>
                                </p>
                            @endforeach
                        </div>
                    @endif
                </div>
            </div>
        </div>

            <!-- Reply / note composer -->
            <div class="mt-6 rounded-2xl border border-[#D6E0E8] bg-white p-5">
                <div class="flex items-center justify-between">
                    <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Composer</h3>
                    @if ($macros->isNotEmpty())
                        <div class="flex flex-wrap items-center justify-end gap-2">
                            <label for="macro" class="text-[11px] font-semibold text-[#98A2B3]">Canned reply:</label>
                            <select id="macro" onchange="insertMacro(this.value)" class="rounded-lg border border-[#D6E0E8] px-2.5 py-1.5 text-[12px] text-[#102840] outline-none focus:border-[#2164b6]">
                                <option value="">Select…</option>
                                @foreach ($macros->groupBy('category') as $category => $items)
                                    <optgroup label="{{ $category ?: 'General' }}">
                                        @foreach ($items as $macro)
                                            <option value="{{ e($macro->body) }}">{{ $macro->name }}</option>
                                        @endforeach
                                    </optgroup>
                                @endforeach
                            </select>
                            <label for="macro-apply" class="ml-2 text-[11px] font-semibold text-[#98A2B3]">Run macro:</label>
                            <form method="POST" action="{{ route('securecrm.tickets.macro', [$ticket, 0]) }}" class="flex items-center gap-2" id="macro-apply-form" onsubmit="return document.getElementById('macro-apply').value !== '';">
                                @csrf
                                <select id="macro-apply" class="rounded-lg border border-[#2164b6]/30 bg-[#2164b6]/5 px-2.5 py-1.5 text-[12px] font-semibold text-[#2164b6] outline-none focus:border-[#2164b6]" onchange="setMacroAction(this.value)">
                                    <option value="">Select…</option>
                                    @foreach ($macros as $macro)
                                        <option value="{{ $macro->id }}">{{ $macro->name }}</option>
                                    @endforeach
                                </select>
                                <button type="submit" title="Apply the macro's actions to this ticket" class="rounded-lg bg-[#2164b6] px-3 py-1.5 text-[12px] font-bold text-white transition-colors hover:bg-[#1b52a0]">Run</button>
                            </form>
                        </div>
                    @endif
                </div>

                <form method="POST" action="{{ route('securecrm.tickets.reply', $ticket) }}" class="mt-4">
                    @csrf
                    <textarea id="reply-body" name="body" rows="4" required maxlength="10000"
                              placeholder="Type a reply to the customer…"
                              class="w-full rounded-lg border border-[#D6E0E8] px-3 py-2.5 text-[14px] leading-relaxed text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15"></textarea>
                    <div class="mt-3 flex items-center justify-end gap-3">
                        <button type="submit" class="rounded-lg bg-[#2164b6] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">
                            Reply to customer
                        </button>
                    </div>
                </form>

                @if (auth('staff')->user()->hasPermission('ticket.note'))
                    <form method="POST" action="{{ route('securecrm.tickets.note', $ticket) }}" class="mt-4 border-t border-[#F0F5F8] pt-4">
                        @csrf
                        <textarea name="body" rows="3" required maxlength="10000"
                                  placeholder="Internal note — only visible to the support team…"
                                  class="w-full rounded-lg border border-[#F59E0B]/40 bg-[#FFFBEB] px-3 py-2.5 text-[13px] leading-relaxed text-[#334155] placeholder-[#B45309]/50 outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15"></textarea>
                        <div class="mt-3 flex items-center justify-end gap-3">
                            <button type="submit" class="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-2 text-[13px] font-semibold text-[#B45309] transition-colors hover:bg-[#F59E0B]/20">
                                Add internal note
                            </button>
                        </div>
                    </form>
                @endif
            </div>
        </div>
            <!-- Actions -->
            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Actions</h3>
                <div class="mt-4 space-y-3">
                    @if (auth('staff')->user()->hasPermission('ticket.assign'))
                        <form method="POST" action="{{ route('securecrm.teams.tickets.assign', $ticket) }}" class="flex gap-2">
                            @csrf
                            <select name="assigned_team_id" class="flex-1 rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                                <option value="">No team</option>
                                @foreach ($teams ?? [] as $team)
                                    <option value="{{ $team->id }}" @selected($ticket->assigned_team_id === $team->id)>{{ $team->name }}</option>
                                @endforeach
                            </select>
                            <button type="submit" class="rounded-lg border border-[#D6E0E8] bg-[#F7FAFC] px-3 py-2 text-[12px] font-semibold text-[#102840] transition-colors hover:border-[#38A8D8]/50 hover:text-[#2164b6]">Team</button>
                            <button type="submit" name="auto_assign" value="1" class="rounded-lg border border-[#2164b6]/30 bg-[#2164b6]/5 px-3 py-2 text-[12px] font-semibold text-[#2164b6] transition-colors hover:bg-[#2164b6]/10" title="Assign to the least-loaded available agent in the team">Auto</button>
                        </form>
                        <form method="POST" action="{{ route('securecrm.tickets.assign', $ticket) }}" class="flex gap-2">
                            @csrf
                            <select name="assigned_agent_id" class="flex-1 rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                                <option value="">Unassigned</option>
                                @foreach ($agents ?? [] as $agent)
                                    <option value="{{ $agent->id }}" @selected($ticket->assigned_agent_id === $agent->id)>{{ $agent->name }}</option>
                                @endforeach
                            </select>
                            <button type="submit" class="rounded-lg border border-[#D6E0E8] bg-[#F7FAFC] px-3 py-2 text-[12px] font-semibold text-[#102840] transition-colors hover:border-[#38A8D8]/50 hover:text-[#2164b6]">Assign</button>
                        </form>
                    @endif

                    @if (auth('staff')->user()->hasPermission('ticket.close'))
                        <form method="POST" action="{{ route('securecrm.tickets.status', $ticket) }}" class="flex gap-2">
                            @csrf
                            <select name="status" class="flex-1 rounded-lg border border-[#D6E0E8] px-3 py-2 text-[13px] text-[#102840] outline-none focus:border-[#2164b6]">
                                @foreach ($statuses ?? [] as $status)
                                    <option value="{{ $status }}" @selected($ticket->status === $status)>{{ str_replace('_', ' ', ucfirst($status)) }}</option>
                                @endforeach
                            </select>
                            <button type="submit" class="rounded-lg border border-[#D6E0E8] bg-[#F7FAFC] px-3 py-2 text-[12px] font-semibold text-[#102840] transition-colors hover:border-[#38A8D8]/50 hover:text-[#2164b6]">Update</button>
                        </form>
                    @endif

                    @if (auth('staff')->user()->hasPermission('ticket.escalate') && $ticket->status !== 'escalated' && $ticket->isOpen())
                        <form method="POST" action="{{ route('securecrm.tickets.escalate', $ticket) }}">
                            @csrf
                            <button type="submit" class="w-full rounded-lg border border-[#DC2626]/30 bg-[#DC2626]/5 px-3 py-2 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#DC2626]/10">
                                Escalate ticket
                            </button>
                        </form>
                    @endif
                </div>
            </div>

            <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Details</h3>
                <dl class="mt-4 space-y-3 text-[13px]">
                    <div class="flex items-start justify-between gap-4">
                        <dt class="text-[#98A2B3]">Customer</dt>
                        <dd class="text-right">
                            <span class="block font-semibold text-[#102840]">{{ $ticket->user?->name ?? 'Public request' }}</span>
                            @if ($ticket->customer_email)
                                <a href="{{ route('securecrm.customers.show', ['email' => $ticket->customer_email]) }}" class="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2164b6] hover:text-[#1b52a0]">
                                    {{ $ticket->user?->email ?? $ticket->customer_email }}
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
                                </a>
                            @else
                                <span class="block text-[11px] text-[#98A2B3]">{{ $ticket->user?->email ?? 'Help center form' }}</span>
                            @endif
                        </dd>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                        <dt class="text-[#98A2B3]">Category</dt>
                        <dd class="font-semibold text-[#102840]">{{ $ticket->category?->name ?? '—' }}</dd>
                    </div>
                    <div class="flex items-start justify-between gap-4">
                        <dt class="text-[#98A2B3]">Tags</dt>
                        <dd class="flex flex-wrap justify-end gap-1.5">
                            @forelse ($ticket->tags as $tag)
                                <span class="rounded-md bg-[#38A8D8]/10 px-2 py-0.5 text-[11px] font-semibold text-[#1f7aa8]">#{{ $tag->name }}</span>
                            @empty
                                <span class="text-[#98A2B3]">—</span>
                            @endforelse
                        </dd>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                        <dt class="text-[#98A2B3]">Assigned agent</dt>
                        <dd class="font-semibold text-[#102840]">{{ $ticket->assignedAgent?->name ?? 'Unassigned' }}</dd>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                        <dt class="text-[#98A2B3]">Assigned team</dt>
                        <dd class="font-semibold text-[#102840]">
                            @if ($ticket->assignedTeam)
                                <a href="{{ route('securecrm.teams.queue', $ticket->assignedTeam) }}" class="text-[#2164b6] hover:text-[#1b52a0]">{{ $ticket->assignedTeam->name }}</a>
                            @else
                                —
                            @endif
                        </dd>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                        <dt class="text-[#98A2B3]">Created by</dt>
                        <dd class="font-semibold text-[#102840]">{{ $ticket->createdBy?->name ?? 'Customer' }}</dd>
                    </div>
                    <div class="flex items-center justify-between gap-4">
                        <dt class="text-[#98A2B3]">Created</dt>
                        <dd class="font-semibold text-[#102840]">{{ $ticket->created_at->format('M j, Y g:i A') }}</dd>
                    </div>
                </dl>
            </div>

            @if ($sla)
                <div id="sla" class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    @php
                        $slaStatusStyles = [
                            'remaining' => 'bg-[#2164b6]/10 text-[#2164b6]',
                            'paused' => 'bg-[#F59E0B]/10 text-[#B45309]',
                            'breached' => 'bg-[#DC2626]/10 text-[#DC2626]',
                            'completed' => 'bg-[#16A34A]/10 text-[#16A34A]',
                        ];
                        $slaMetrics = [
                            'first_response' => 'First response',
                            'next_response' => 'Next response',
                            'resolution' => 'Resolution',
                        ];
                        $slaFmt = fn ($seconds) => $seconds >= 86400
                            ? round($seconds / 86400).'d'
                            : ($seconds >= 3600 ? round($seconds / 3600).'h' : ceil($seconds / 60).'m');
                    @endphp
                    <div class="flex items-center justify-between">
                        <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">SLA</h3>
                        <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $slaStatusStyles[$sla['status']] ?? 'bg-[#F0F5F8] text-[#667085]' }}">{{ ucfirst($sla['status']) }}</span>
                    </div>
                    <p class="mt-1 text-[12px] font-semibold text-[#2164b6]">{{ $sla['policy']['name'] ?? 'Policy' }}</p>

                    @php
                        $progressColor = $sla['status'] === 'breached' ? 'bg-[#DC2626]' : ($sla['status'] === 'paused' ? 'bg-[#F59E0B]' : 'bg-[#2164b6]');
                    @endphp
                    <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F0F5F8]">
                        <div class="h-full rounded-full {{ $progressColor }} transition-all" style="width: {{ min(100, max(4, $sla['resolution']['progress'])) }}%"></div>
                    </div>

                    <dl class="mt-4 space-y-3 text-[13px]">
                        @foreach ($slaMetrics as $key => $label)
                            @php $metric = $sla[$key]; @endphp
                            @if (! $metric)
                                @continue
                            @endif
                            <div class="flex items-center justify-between gap-4">
                                <dt class="text-[#98A2B3]">{{ $label }}</dt>
                                <dd class="flex items-center gap-2">
                                    <span class="font-semibold text-[#102840]">{{ $metric['status'] === 'completed' ? 'Met' : ($metric['status'] === 'breached' ? 'Breached' : $slaFmt($metric['remaining']).' left') }}</span>
                                </dd>
                            </div>
                        @endforeach
                        @if ($sla['paused'])
                            <div class="flex items-center justify-between gap-4 border-t border-[#F0F5F8] pt-3">
                                <dt class="text-[#B45309]">Waiting on customer</dt>
                                <dd class="font-semibold text-[#B45309]">Clock paused</dd>
                            </div>
                        @endif
                    </dl>
                </div>
            @endif

            @if ($ticket->first_response_at || $ticket->resolved_at || $ticket->closed_at)
                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Timeline</h3>
                    <dl class="mt-4 space-y-3 text-[13px]">
                        @if ($ticket->first_response_at)
                            <div class="flex items-center justify-between gap-4">
                                <dt class="text-[#98A2B3]">First response</dt>
                                <dd class="font-semibold text-[#102840]">{{ $ticket->first_response_at->format('M j, Y g:i A') }}</dd>
                            </div>
                        @endif
                        @if ($ticket->resolved_at)
                            <div class="flex items-center justify-between gap-4">
                                <dt class="text-[#98A2B3]">Resolved</dt>
                                <dd class="font-semibold text-[#102840]">{{ $ticket->resolved_at->format('M j, Y g:i A') }}</dd>
                            </div>
                        @endif
                        @if ($ticket->closed_at)
                            <div class="flex items-center justify-between gap-4">
                                <dt class="text-[#98A2B3]">Closed</dt>
                                <dd class="font-semibold text-[#102840]">{{ $ticket->closed_at->format('M j, Y g:i A') }}</dd>
                            </div>
                        @endif
                    </dl>
                </div>
            @endif
        </div>
    </div>

    <script>
        function insertMacro(body) {
            if (!body) return;
            const textarea = document.getElementById('reply-body');
            if (!textarea) return;
            textarea.value = textarea.value + (textarea.value ? '\n\n' : '') + body;
            textarea.focus();
            textarea.scrollTop = textarea.scrollHeight;
        }

        function setMacroAction(id) {
            if (!id) return;
            const form = document.getElementById('macro-apply-form');
            form.action = form.action.replace(/\/macro\/\d+$/, '/macro/' + id);
        }
    </script>
@endsection
