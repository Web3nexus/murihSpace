@extends('securecrm.layouts.app')

@section('title', $title)
@section('crumb', 'SecureCRM')
@section('heading', $title)

@section('content')
    <div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#B7C6D1] bg-white px-6 py-24 text-center">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#102840] text-white">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-6">
                <path d="M8 8h13M8 12h13M8 16h13"/>
                <ellipse cx="4" cy="8" rx="1" ry="1.5"/>
                <ellipse cx="4" cy="12" rx="1" ry="1.5"/>
                <ellipse cx="4" cy="16" rx="1" ry="1.5"/>
            </svg>
        </div>
        <h2 class="mt-5 text-xl font-bold tracking-tight text-[#102840]">{{ $title }}</h2>
        <p class="mt-1.5 max-w-md text-[14px] leading-relaxed text-[#667085]">{{ $description }}</p>
        <div class="mt-6 inline-flex items-center gap-2 rounded-full border border-[#D6E0E8] bg-[#F7FAFC] px-4 py-1.5 text-[12px] font-semibold text-[#667085]">
            <span class="h-1.5 w-1.5 rounded-full bg-[#F59E0B]"></span>
            Coming in a later sprint
        </div>
    </div>
@endsection