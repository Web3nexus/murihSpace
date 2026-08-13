@extends('securecrm.layouts.app')

@section('title', 'Customers')
@section('crumb', 'SecureCRM / Support / Customers')
@section('heading', 'Customers')

@section('content')
    <form method="GET" action="{{ route('securecrm.customers') }}" class="flex flex-wrap items-center gap-3">
        <div class="relative min-w-64 flex-1 sm:max-w-md">
            <span class="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4 text-[#98A2B3]"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
            <input type="text" name="q" value="{{ $q }}"
                   placeholder="Search by email or name…"
                   class="w-full rounded-lg border border-[#D6E0E8] bg-white py-2.5 pl-10 pr-4 text-[13px] text-[#102840] placeholder-[#98A2B3] outline-none focus:border-[#2164b6] focus:ring-2 focus:ring-[#2164b6]/15">
        </div>
        <button type="submit" class="rounded-lg bg-[#2164b6] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1b52a0]">Search</button>
        @if ($q !== '')
            <a href="{{ route('securecrm.customers') }}" class="text-[13px] font-semibold text-[#98A2B3] hover:text-[#102840]">Clear</a>
        @endif
    </form>

    <p class="mt-4 text-[12px] text-[#98A2B3]">
        {{ $total }} customer{{ $total === 1 ? '' : 's' }} {{ $q !== '' ? 'matching' : 'with support tickets' }}…
        <span class="ml-1 font-medium text-[#667085]">profiles pull live data from the main application.</span>
    </p>

    <div class="mt-5 overflow-hidden rounded-2xl border border-[#D6E0E8] bg-white">
        @if ($customers->isEmpty())
            <div class="px-6 py-16 text-center">
                <p class="text-[14px] font-semibold text-[#667085]">No customers found</p>
                <p class="mt-1 text-[12px] text-[#98A2B3]">Try a different email or name, or create a ticket to start a customer record.</p>
            </div>
        @else
            <table class="w-full text-left text-[13px]">
                <thead>
                    <tr class="border-b border-[#F0F5F8] text-[11px] font-bold uppercase tracking-wide text-[#98A2B3]">
                        <th class="px-6 py-3">Customer</th>
                        <th class="px-6 py-3">Open tickets</th>
                        <th class="px-6 py-3">Total tickets</th>
                        <th class="px-6 py-3"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-[#F0F5F8]">
                    @foreach ($customers as $customer)
                        <tr class="transition-colors hover:bg-[#F7FAFC]">
                            <td class="px-6 py-4">
                                <p class="font-semibold text-[#102840]">{{ $customer['name'] ?: '—' }}</p>
                                <p class="text-[12px] text-[#98A2B3]">{{ $customer['email'] }}</p>
                            </td>
                            <td class="px-6 py-4">
                                @if ($customer['open'] > 0)
                                    <span class="inline-flex rounded-full bg-[#F59E0B]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#B45309]">{{ $customer['open'] }} open</span>
                                @else
                                    <span class="text-[12px] text-[#98A2B3]">—</span>
                                @endif
                            </td>
                            <td class="px-6 py-4 text-[#102840]">{{ $customer['tickets'] }}</td>
                            <td class="px-6 py-4 text-right">
                                <a href="{{ route('securecrm.customers.show', ['email' => $customer['email']]) }}"
                                   class="inline-flex items-center gap-1 rounded-lg border border-[#D6E0E8] bg-[#F7FAFC] px-3 py-1.5 text-[12px] font-semibold text-[#2164b6] transition-colors hover:border-[#38A8D8]/50 hover:bg-white">
                                    View profile
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-3"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
                                </a>
                            </td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        @endif
    </div>
@endsection