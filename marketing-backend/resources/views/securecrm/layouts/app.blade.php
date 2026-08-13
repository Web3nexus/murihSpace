<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title', 'SecureCRM') | {{ config('app.name', 'MurihSpace') }}</title>
    @fonts
    @if (file_exists(public_path('build/manifest.json')) || file_exists(public_path('hot')))
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    @endif
</head>
<body class="bg-[#F7FAFC] text-[#102840] antialiased">
    @php
        $staff = auth('staff')->user();
        $sectionGroups = [
            'Main' => [
                ['label' => 'Overview', 'route' => 'securecrm.overview', 'icon' => 'overview'],
            ],
            'Support' => [
                ['label' => 'Tickets', 'route' => 'securecrm.tickets', 'icon' => 'tickets'],
                ['label' => 'Customers', 'route' => 'securecrm.customers', 'icon' => 'customers'],
                ['label' => 'CRM', 'route' => 'securecrm.crm', 'icon' => 'crm'],
            ],
            'Content' => [
                ['label' => 'Help Center', 'route' => 'securecrm.help', 'icon' => 'help'],
                ['label' => 'Website CMS', 'route' => 'securecrm.cms', 'icon' => 'cms'],
                ['label' => 'Announcements', 'route' => 'securecrm.announcements', 'icon' => 'announcements'],
                ['label' => 'Knowledge Base', 'route' => 'securecrm.knowledge', 'icon' => 'knowledge'],
            ],
            'Operations' => [
                ['label' => 'Reports', 'route' => 'securecrm.reports', 'icon' => 'reports'],
                ['label' => 'Agents', 'route' => 'securecrm.agents', 'icon' => 'agents'],
                ['label' => 'Teams', 'route' => 'securecrm.teams', 'icon' => 'teams'],
                ['label' => 'SLAs', 'route' => 'securecrm.slas', 'icon' => 'slas'],
                ['label' => 'Macros', 'route' => 'securecrm.macros', 'icon' => 'macros'],
                ['label' => 'Automation', 'route' => 'securecrm.automation', 'icon' => 'automation'],
                ['label' => 'Integrations', 'route' => 'securecrm.integrations', 'icon' => 'integrations'],
                ['label' => 'Audit Logs', 'route' => 'securecrm.audit', 'icon' => 'audit'],
            ],
            'System' => [
                ['label' => 'Settings', 'route' => 'securecrm.settings', 'icon' => 'settings'],
            ],
        ];

        $sections = array_filter(array_map(function ($group) use ($staff) {
            $items = array_values(array_filter($group, function ($item) use ($staff) {
                $section = $item['route'] === 'securecrm.overview' ? 'overview' : str_replace('securecrm.', '', $item['route']);

                return $staff?->canAccessSection($section);
            }));

            return $items ?: null;
        }, $sectionGroups));

        $icons = [
            'overview' => '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
            'tickets' => '<path d="M4 4h16v16H4Z"/><line x1="8" x2="20" y1="9" y2="9"/><line x1="8" x2="20" y1="15" y2="15"/><line x1="8" x2="20" y1="18" y2="18"/>',
            'customers' => '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a7 7 0 0 1 14 0v1"/>',
            'crm' => '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 3v18M16 3v18M3 8h18M3 16h18"/>',
            'help' => '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a2.8 2.8 0 0 1 5.6 0c0 1.8-2.8 2.2-2.8 4"/><path d="M12 17h.01"/>',
            'cms' => '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="m7 8 4 4-4 4"/><path d="M13 16h4"/>',
            'announcements' => '<path d="M14 2v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Z"/><path d="m22 7-5-2v9l5 2Z"/><path d="M6 5v14a2 2 0 0 0 2 2h2"/>',
            'knowledge' => '<path d="M4 19.5V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14.5"/><path d="M4 22h16"/><path d="M8 7h8M8 11h8"/>',
            'reports' => '<path d="M3 3v18h18"/><path d="m7 14 3-3 3 3 4-5"/>',
            'agents' => '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
            'teams' => '<path d="M9 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/><path d="M4 21a4 4 0 0 1 10 0Z"/><path d="M16 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"/><path d="M20 21a4 4 0 0 0-6-3.6"/>',
            'slas' => '<path d="M12 4v2m0 12v2m8-8h-2M6 12H4m13-6-2 2m-8 8L5 20m12-12-2 2m0 8 2 2M7 14l2-2M5 5l2 2"/><circle cx="12" cy="12" r="3"/>',
            'macros' => '<path d="m9 4 3 5 3-5z"/><path d="m15 6 2-1 1 2-2 1Z"/><path d="m9 6-3 8"/><path d="M9 14h6v5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1Z"/>',
            'automation' => '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z"/>',
            'integrations' => '<circle cx="8" cy="18" r="3"/><circle cx="8" cy="6" r="3"/><circle cx="16" cy="12" r="3"/><path d="M8 6v3a3 3 0 0 0 3 3h2"/>',
            'audit' => '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
            'settings' => '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
        ];
    @endphp

    <div class="flex min-h-screen">
        <!-- Sidebar -->
        <aside class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-[#102840] lg:flex">
            <div class="flex h-16 items-center gap-3 border-b border-white/10 px-5">
                <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#38A8D8] text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4.5"><path d="M12 2 4 6v6c0 5.5 3.4 9.7 8 10 4.6-.3 8-4.5 8-10V6Z"/></svg>
                </div>
                <div>
                    <p class="text-[15px] font-bold leading-tight text-white">SecureCRM</p>
                    <p class="text-[10px] font-medium uppercase tracking-wide text-[#38A8D8]">Support Console</p>
                </div>
            </div>

            <nav class="flex-1 overflow-y-auto px-3 py-4" aria-label="SecureCRM navigation">
                @foreach ($sections as $groupName => $group)
                    <p class="mt-4 mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-[rgba(247,250,252,0.45)] first:mt-0">
                        {{ $groupName }}
                    </p>
                    <ul class="space-y-0.5">
                        @foreach ($group as $item)
                            @php
                                $active = request()->routeIs($item['route']);
                                $routeExists = Route::has($item['route']);
                            @endphp
                            <li>
                                @if ($routeExists)
                                    <a href="{{ route($item['route']) }}"
                                        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors
                                        {{ $active
                                            ? 'bg-[rgba(255,255,255,0.12)] text-white shadow-[inset_2px_0_0_0_#38A8D8]'
                                            : 'text-[rgba(247,250,252,0.90)] hover:bg-[rgba(255,255,255,0.08)]' }}">
                                        <span class="shrink-0 {{ $active ? 'text-[#38A8D8]' : 'text-[rgba(247,250,252,0.55)]' }}">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">{!! $icons[$item['icon']] !!}</svg>
                                        </span>
                                        {{ $item['label'] }}
                                    </a>
                                @else
                                    <span class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-[rgba(247,250,252,0.50)]">
                                        <i class="shrink-0 text-[rgba(247,250,252,0.35)]">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">{!! $icons[$item['icon']] !!}</svg>
                                        </i>
                                        {{ $item['label'] }}
                                        <span class="ml-auto rounded-full bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[10px] font-semibold text-[rgba(247,250,252,0.55)]">Soon</span>
                                    </span>
                                @endif
                            </li>
                        @endforeach
                    </ul>
                @endforeach
            </nav>

            <div class="border-t border-white/10 p-3">
                <div class="flex items-center gap-3 rounded-lg px-3 py-2.5">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#38A8D8]/20 text-[13px] font-bold text-[#38A8D8]">
                        {{ strtoupper(Str::substr(auth('staff')->user()?->name ?? 'A', 0, 1)) }}
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="truncate text-[13px] font-semibold text-white">{{ auth('staff')->user()?->name }}</p>
                        <p class="truncate text-[11px] text-[rgba(247,250,252,0.55)]">{{ auth('staff')->user()?->role }}</p>
                    </div>
                    <form method="POST" action="{{ route('securecrm.logout') }}">
                        @csrf
                        <button type="submit" title="Sign out" class="rounded-lg p-1.5 text-[rgba(247,250,252,0.6)] hover:bg-[rgba(255,255,255,0.08)] hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
                        </button>
                    </form>
                </div>
            </div>
        </aside>

        <!-- Mobile header -->
        <div class="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[#D6E0E8] bg-[#102840] px-4 lg:hidden">
            <div class="flex items-center gap-2">
                <div class="flex h-7 w-7 items-center justify-center rounded-md bg-[#38A8D8] text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="size-4"><path d="M12 2 4 6v6c0 5.5 3.4 9.7 8 10 4.6-.3 8-4.5 8-10V6Z"/></svg>
                </div>
                <span class="text-sm font-bold text-white">SecureCRM</span>
            </div>
            <form method="POST" action="{{ route('securecrm.logout') }}">
                @csrf
                <button type="submit" class="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white">Sign out</button>
            </form>
        </div>

        <!-- Main column -->
        <div class="flex min-h-screen w-full flex-1 flex-col lg:pl-64">
            <!-- Sticky header -->
            <header class="sticky top-0 z-10 border-b border-[#D6E0E8] bg-white/85 backdrop-blur-md">
                <div class="flex h-16 items-center gap-4 px-6 lg:px-8">
                    <div class="flex-1">
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-[#98A2B3]">@yield('crumb', 'SecureCRM')</p>
                        <h1 class="text-lg font-bold tracking-tight text-[#102840]">@yield('heading')</h1>
                    </div>
                    <div class="flex items-center gap-3">
                        <a href="/" class="hidden rounded-lg border border-[#D6E0E8] px-3 py-1.5 text-[12px] font-semibold text-[#667085] transition-colors hover:border-[#38A8D8]/50 hover:text-[#2164b6] sm:inline-flex">
                            View public site
                        </a>

                        @php
                            $unreadNotifications = $staff?->unreadNotifications()->count() ?? 0;
                            $recentNotifications = $staff?->notifications()->latest()->take(5)->get() ?? collect();
                        @endphp
                        <details class="relative">
                            <summary title="Notifications"
                                class="relative flex h-9 w-9 list-none cursor-pointer items-center justify-center rounded-lg border border-[#D6E0E8] text-[#667085] transition-colors hover:border-[#38A8D8]/50 hover:text-[#2164b6]">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-4">
                                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                                </svg>
                                @if ($unreadNotifications > 0)
                                    <span class="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D64045] px-1 text-[10px] font-bold text-white">
                                        {{ $unreadNotifications > 99 ? '99+' : $unreadNotifications }}
                                    </span>
                                @endif
                            </summary>

                            <div class="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-[#D6E0E8] bg-white shadow-xl">
                                <div class="flex items-center justify-between border-b border-[#D6E0E8] px-4 py-3">
                                    <p class="text-[13px] font-bold text-[#102840]">Notifications</p>
                                    @if ($unreadNotifications > 0)
                                        <form method="POST" action="{{ route('securecrm.notifications.read-all') }}">
                                            @csrf
                                            <button type="submit" class="text-[11px] font-semibold text-[#2164b6] hover:underline">Mark all read</button>
                                        </form>
                                    @endif
                                </div>

                                <div class="max-h-80 divide-y divide-[#F0F4F8] overflow-y-auto">
                                    @forelse ($recentNotifications as $notification)
                                        <a href="{{ $notification->data['action_url'] ?? route('securecrm.notifications') }}"
                                            class="flex gap-3 px-4 py-3 transition-colors hover:bg-[#F7FAFC]">
                                            <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full {{ $notification->read_at ? 'bg-[#D6E0E8]' : 'bg-[#38A8D8]' }}"></span>
                                            <span class="min-w-0">
                                                <span class="block truncate text-[12px] font-semibold text-[#102840]">{{ $notification->data['title'] ?? 'Notification' }}</span>
                                                <span class="block truncate text-[11px] text-[#667085]">{{ $notification->data['message'] ?? '' }}</span>
                                                <span class="mt-0.5 block text-[10px] text-[#98A2B3]">{{ $notification->created_at->diffForHumans() }}</span>
                                            </span>
                                        </a>
                                    @empty
                                        <p class="px-4 py-8 text-center text-[12px] text-[#98A2B3]">You're all caught up.</p>
                                    @endforelse
                                </div>

                                <a href="{{ route('securecrm.notifications') }}"
                                    class="block border-t border-[#D6E0E8] px-4 py-2.5 text-center text-[11px] font-bold text-[#2164b6] hover:bg-[#F7FAFC]">
                                    View all notifications
                                </a>
                            </div>
                        </details>

                        <div class="flex h-9 w-9 items-center justify-center rounded-full bg-[#102840] text-[13px] font-bold text-white lg:hidden">
                            {{ strtoupper(Str::substr(auth('staff')->user()?->name ?? 'A', 0, 1)) }}
                        </div>
                    </div>
                </div>
            </header>

            <main class="flex-1 px-6 py-8 lg:px-8">
                @yield('content')
            </main>

            <footer class="border-t border-[#D6E0E8] px-6 py-4 lg:px-8">
                <p class="text-[11px] text-[#98A2B3]">
                    SecureCRM · {{ config('app.name', 'MurihSpace') }} support operations · Faster. Smarter. Secure.
                </p>
            </footer>
        </div>
    </div>
</body>
</html>