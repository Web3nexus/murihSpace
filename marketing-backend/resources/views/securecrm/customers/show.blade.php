@extends('securecrm.layouts.app')

@section('title', $user['name'] ?? $email)
@section('crumb', 'SecureCRM / Support / Customers')
@section('heading', $user['name'] ?? $email)

@section('content')
    <div class="flex flex-wrap items-center justify-between gap-3">
        <a href="{{ route('securecrm.customers') }}" class="text-[13px] font-semibold text-[#2164b6] hover:text-[#1b52a0]">← All customers</a>
        <span class="text-[12px] text-[#98A2B3]">{{ $email }}</span>
    </div>

    @php
        $statusStyles = [
            'active' => 'bg-[#16A34A]/10 text-[#16A34A]',
            'suspended' => 'bg-[#DC2626]/10 text-[#DC2626]',
            'banned' => 'bg-[#DC2626]/10 text-[#DC2626]',
            'member' => 'bg-[#38A8D8]/10 text-[#2164b6]',
            'creator' => 'bg-[#2164b6]/10 text-[#2164b6]',
            'vendor' => 'bg-[#7C3AED]/10 text-[#7C3AED]',
        ];
        $kycStyles = [
            'verified' => 'bg-[#16A34A]/10 text-[#16A34A]',
            'pending' => 'bg-[#F59E0B]/10 text-[#B45309]',
            'rejected' => 'bg-[#DC2626]/10 text-[#DC2626]',
            'not_required' => 'bg-[#98A2B3]/10 text-[#667085]',
        ];
    @endphp

    @if (! $has_data)
        <div class="mt-6 rounded-2xl border border-[#F59E0B]/30 bg-[#FFFBEB] px-6 py-4 text-[13px] text-[#B45309]">
            No main-application account was found for this email (or the main backend is unreachable).
            Only local support data is shown below.
        </div>
    @else
        <!-- Profile header -->
        <div class="mt-6 rounded-2xl border border-[#D6E0E8] bg-white p-6">
            <div class="flex flex-wrap items-center gap-4">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#102840] text-lg font-bold text-white">
                    {{ strtoupper(Str::substr($user['name'] ?? $email, 0, 2)) }}
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                        <h2 class="text-xl font-bold tracking-tight text-[#102840]">{{ $user['name'] ?? '—' }}</h2>
                        <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $statusStyles[$user['status'] ?? ''] ?? 'bg-[#F0F5F8] text-[#667085]' }}">
                            {{ ucfirst($user['status'] ?? 'unknown') }}
                        </span>
                        <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $statusStyles[$user['role'] ?? ''] ?? 'bg-[#F0F5F8] text-[#667085]' }}">
                            {{ ucfirst($user['role'] ?? 'member') }}
                        </span>
                    </div>
                    <p class="mt-0.5 text-[13px] text-[#667085]">
                        {{ $user['email'] ?? $email }}
                        @if (! empty($user['username'])) · <span class="font-medium text-[#102840]">@{{ $user['username'] }}</span> @endif
                    </p>
                    <div class="mt-2 flex flex-wrap gap-2">
                        <span class="inline-flex items-center gap-1.5 rounded-full border border-[#D6E0E8] bg-[#F7FAFC] px-2.5 py-0.5 text-[11px] font-semibold text-[#667085]">
                            <span class="h-1.5 w-1.5 rounded-full {{ ($user['has_verified_email'] ?? false) ? 'bg-[#16A34A]' : 'bg-[#98A2B3]' }}"></span>
                            Email {{ ($user['has_verified_email'] ?? false) ? 'verified' : 'unverified' }}
                        </span>
                        <span class="inline-flex items-center gap-1.5 rounded-full border border-[#D6E0E8] bg-[#F7FAFC] px-2.5 py-0.5 text-[11px] font-semibold text-[#667085]">
                            <span class="h-1.5 w-1.5 rounded-full {{ ($user['has_verified_phone'] ?? false) ? 'bg-[#16A34A]' : 'bg-[#98A2B3]' }}"></span>
                            Phone {{ ($user['has_verified_phone'] ?? false) ? 'verified' : 'unverified' }}
                        </span>
                        <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $kycStyles[$user['kyc_status'] ?? ''] ?? 'bg-[#F0F5F8] text-[#667085]' }}">
                            KYC: {{ str_replace('_', ' ', $user['kyc_status'] ?? 'unknown') }}
                        </span>
                    </div>
                </div>
                <dl class="grid shrink-0 grid-cols-2 gap-x-8 gap-y-2 text-[13px] sm:grid-cols-3">
                    <div>
                        <dt class="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Member since</dt>
                        <dd class="font-semibold text-[#102840]">{{ isset($user['created_at']) ? \Carbon\Carbon::parse($user['created_at'])->format('M j, Y') : '—' }}</dd>
                    </div>
                    <div>
                        <dt class="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Country</dt>
                        <dd class="font-semibold text-[#102840]">{{ $user['country'] ?? '—' }}</dd>
                    </div>
                    <div>
                        <dt class="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">Mobile</dt>
                        <dd class="font-semibold text-[#102840]">{{ $user['mobile_number'] ?? '—' }}</dd>
                    </div>
                </dl>
            </div>
        </div>
    @endif

    <div class="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <!-- Left column: local support data -->
        <div class="space-y-6 xl:col-span-2">
            <!-- Tickets -->
            <div class="rounded-2xl border border-[#D6E0E8] bg-white">
                <div class="flex items-center justify-between gap-3 border-b border-[#F0F5F8] px-6 py-4">
                    <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Tickets</h3>
                    <span class="rounded-full bg-[#F0F5F8] px-2.5 py-0.5 text-[11px] font-bold text-[#667085]">{{ $tickets->count() }}</span>
                </div>
                @if ($tickets->isEmpty())
                    <p class="px-6 py-8 text-center text-[13px] text-[#98A2B3]">No support tickets for this customer.</p>
                @else
                    <ul class="divide-y divide-[#F0F5F8]">
                        @foreach ($tickets as $ticket)
                            <li class="flex flex-wrap items-center gap-3 px-6 py-3.5">
                                <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-[#F0F5F8] text-[#667085]">{{ $ticket->ticket_number }}</span>
                                <a href="{{ route('securecrm.tickets.show', $ticket) }}" class="flex-1 truncate text-[13px] font-semibold text-[#102840] hover:text-[#2164b6]">{{ $ticket->subject }}</a>
                                <span class="text-[12px] text-[#98A2B3]">{{ $ticket->category?->name }}</span>
                                <span class="text-[12px] text-[#98A2B3]">{{ $ticket->created_at->format('M j, Y') }}</span>
                            </li>
                        @endforeach
                    </ul>
                @endif
            </div>

            <!-- Support notes -->
            <div class="rounded-2xl border border-[#D6E0E8] bg-white">
                <div class="flex items-center justify-between gap-3 border-b border-[#F0F5F8] px-6 py-4">
                    <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Support notes</h3>
                    <span class="rounded-full bg-[#F0F5F8] px-2.5 py-0.5 text-[11px] font-bold text-[#667085]">{{ $notes->count() }}</span>
                </div>

                @if (auth('staff')->user()->hasPermission('customer.notes.create'))
                    <form method="POST" action="{{ route('securecrm.customers.notes.store', ['email' => $email]) }}" class="border-b border-[#F0F5F8] px-6 py-4">
                        @csrf
                        <textarea name="body" rows="3" required maxlength="5000" placeholder="Private note shared with the support team…"
                                  class="w-full rounded-lg border border-[#F59E0B]/40 bg-[#FFFBEB] px-3 py-2.5 text-[13px] leading-relaxed text-[#334155] placeholder-[#B45309]/50 outline-none focus:border-[#F59E0B] focus:ring-2 focus:ring-[#F59E0B]/15"></textarea>
                        <div class="mt-3 flex items-center justify-end">
                            <button type="submit" class="rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 px-4 py-2 text-[12px] font-semibold text-[#B45309] transition-colors hover:bg-[#F59E0B]/20">Add note</button>
                        </div>
                    </form>
                @endif

                @if ($notes->isEmpty())
                    <p class="px-6 py-6 text-center text-[13px] text-[#98A2B3]">No notes yet.</p>
                @else
                    <ul class="divide-y divide-[#F0F5F8]">
                        @foreach ($notes as $note)
                            <li class="px-6 py-4">
                                <p class="whitespace-pre-wrap text-[13px] leading-relaxed text-[#334155]">{{ $note->body }}</p>
                                <p class="mt-2 text-[11px] text-[#98A2B3]">{{ $note->staffUser?->name ?? 'Unknown agent' }} · {{ $note->created_at->format('M j, Y g:i A') }}</p>
                            </li>
                        @endforeach
                    </ul>
                @endif
            </div>

            <!-- Orders -->
            <div class="rounded-2xl border border-[#D6E0E8] bg-white">
                <div class="flex items-center justify-between gap-3 border-b border-[#F0F5F8] px-6 py-4">
                    <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Orders</h3>
                    <span class="rounded-full bg-[#F0F5F8] px-2.5 py-0.5 text-[11px] font-bold text-[#667085]">{{ count($orders) }}</span>
                </div>
                @if (count($orders) === 0)
                    <p class="px-6 py-8 text-center text-[13px] text-[#98A2B3]">No orders recorded.</p>
                @else
                    <ul class="divide-y divide-[#F0F5F8]">
                        @foreach ($orders as $order)
                            <li class="flex flex-wrap items-center gap-3 px-6 py-3.5">
                                <span class="text-[13px] font-semibold text-[#102840]">{{ $order['order_number'] }}</span>
                                <span class="flex-1 truncate text-[13px] text-[#667085]">{{ $order['product'] ?? '—' }}</span>
                                <span class="inline-flex rounded-full bg-[#F0F5F8] px-2.5 py-0.5 text-[11px] font-bold text-[#667085]">{{ ucfirst($order['status']) }}</span>
                                <span class="text-[13px] font-bold text-[#102840]">{{ number_format((float) $order['total'], 2) }} {{ $order['currency'] }}</span>
                            </li>
                        @endforeach
                    </ul>
                @endif
            </div>

            <!-- Transactions -->
            <div class="rounded-2xl border border-[#D6E0E8] bg-white">
                <div class="flex items-center justify-between gap-3 border-b border-[#F0F5F8] px-6 py-4">
                    <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Recent transactions</h3>
                    <span class="rounded-full bg-[#F0F5F8] px-2.5 py-0.5 text-[11px] font-bold text-[#667085]">{{ count($transactions) }}</span>
                </div>
                @if (count($transactions) === 0)
                    <p class="px-6 py-8 text-center text-[13px] text-[#98A2B3]">No transactions recorded.</p>
                @else
                    <ul class="divide-y divide-[#F0F5F8]">
                        @foreach ($transactions as $txn)
                            <li class="flex flex-wrap items-center gap-3 px-6 py-3.5">
                                <span class="text-[13px] font-semibold text-[#102840]">{{ ucfirst(str_replace('_', ' ', $txn['type'] ?? '—')) }}</span>
                                <span class="flex-1 truncate text-[13px] text-[#667085]">{{ $txn['description'] ?? '—' }}</span>
                                <span class="inline-flex rounded-full bg-[#F0F5F8] px-2.5 py-0.5 text-[11px] font-bold text-[#667085]">{{ ucfirst($txn['status'] ?? '—') }}</span>
                                <span class="text-[13px] font-bold {{ ($txn['entry_type'] ?? '') === 'debit' ? 'text-[#DC2626]' : 'text-[#16A34A]' }}">
                                    {{ ($txn['entry_type'] ?? '') === 'debit' ? '−' : '+' }}{{ number_format((float) $txn['amount'], 2) }} {{ $txn['currency'] }}
                                </span>
                            </li>
                        @endforeach
                    </ul>
                @endif
            </div>
        </div>

        <!-- Right column: account context -->
        <div class="space-y-6">
            @if ($has_data)
                <!-- Wallet -->
                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Wallet</h3>
                    @if ($wallet && (filled($wallet['wallets']) || $wallet['creator_wallet']))
                        @foreach ($wallet['wallets'] as $w)
                            <div class="mt-4 flex items-center justify-between border-b border-[#F0F5F8] pb-3">
                                <div>
                                    <p class="text-[13px] font-semibold text-[#102840]">{{ str_replace('_', ' ', ucfirst($w['wallet_type'])) }}</p>
                                    <p class="text-[11px] text-[#98A2B3]">{{ $w['currency'] ?? 'USD' }}</p>
                                </div>
                                <span class="text-[13px] font-bold text-[#102840]">{{ number_format((float) ($w['available'] ?? 0), 2) }}</span>
                            </div>
                        @endforeach
                        @if ($wallet['creator_wallet'])
                            <div class="mt-4">
                                <p class="text-[12px] font-semibold text-[#98A2B3]">Creator earnings</p>
                                <p class="mt-1 text-lg font-bold text-[#102840]">
                                    {{ number_format((float) ($wallet['creator_wallet']['available_balance'] ?? 0), 2) }}
                                    <span class="text-[12px] font-semibold text-[#98A2B3]">available</span>
                                </p>
                                <p class="mt-1 text-[11px] text-[#98A2B3]">
                                    Net earnings {{ number_format((float) ($wallet['creator_wallet']['net_earnings'] ?? 0), 2) }}
                                </p>
                            </div>
                        @endif
                    @else
                        <p class="mt-3 text-[13px] text-[#98A2B3]">No wallet data.</p>
                    @endif
                </div>

                <!-- Subscriptions -->
                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Subscriptions</h3>
                    @if (count($subscriptions) === 0)
                        <p class="mt-3 text-[13px] text-[#98A2B3]">No subscriptions.</p>
                    @else
                        <ul class="mt-3 space-y-3">
                            @foreach ($subscriptions as $sub)
                                <li class="flex items-center justify-between gap-3 border-b border-[#F0F5F8] pb-3 last:border-0 last:pb-0">
                                    <div class="min-w-0">
                                        <p class="truncate text-[13px] font-semibold text-[#102840]">{{ $sub['plan_name'] ?? ('Plan #'.$sub['creator_id']) }}</p>
                                        <p class="text-[11px] text-[#98A2B3]">
                                            @if (isset($sub['current_period_end']))
                                                Renews {{ \Carbon\Carbon::parse($sub['current_period_end'])->format('M j, Y') }}
                                            @elseif (isset($sub['canceled_at']))
                                                Canceled {{ \Carbon\Carbon::parse($sub['canceled_at'])->format('M j, Y') }}
                                            @endif
                                        </p>
                                    </div>
                                    <span class="inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ ($sub['active'] ?? false) ? 'bg-[#16A34A]/10 text-[#16A34A]' : 'bg-[#98A2B3]/10 text-[#667085]' }}">
                                        {{ $sub['active'] ? 'Active' : ucfirst($sub['status'] ?? 'inactive') }}
                                    </span>
                                </li>
                            @endforeach
                        </ul>
                    @endif
                </div>

                <!-- KYC -->
                <div class="rounded-2xl border border-[#D6E0E8] bg-white p-6">
                    <h3 class="text-[13px] font-bold uppercase tracking-wide text-[#98A2B3]">Identification</h3>
                    <div class="mt-3 space-y-3">
                        @foreach ($kyc['verifications'] ?? [] as $verification)
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <p class="text-[13px] font-semibold text-[#102840]">{{ ucfirst($verification['provider']) }}</p>
                                    <p class="text-[11px] text-[#98A2B3]">{{ ucfirst($verification['status']) }} · {{ isset($verification['completed_at']) ? \Carbon\Carbon::parse($verification['completed_at'])->format('M j, Y') : 'started '.($verification['started_at'] ? \Carbon\Carbon::parse($verification['started_at'])->format('M j, Y') : '—') }}</p>
                                </div>
                                <span class="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold {{ $kycStyles[$verification['status']] ?? 'bg-[#F0F5F8] text-[#667085]' }}">
                                    {{ ucfirst($verification['status']) }}
                                </span>
                            </div>
                        @endforeach
                        @if (empty($kyc['verifications'] ?? []))
                            <p class="text-[13px] text-[#98A2B3]">No verification records.</p>
                        @endif
                    </div>
                </div>
            @endif
        </div>
    </div>
@endsection