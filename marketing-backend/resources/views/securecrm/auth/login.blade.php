<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Staff Login — SecureCRM | {{ config('app.name', 'MurihSpace') }}</title>
    @fonts
    @if (file_exists(public_path('build/manifest.json')) || file_exists(public_path('hot')))
        @vite(['resources/css/app.css', 'resources/js/app.js'])
    @endif
</head>
<body class="bg-[#F7FAFC] text-[#102840] antialiased">
    <div class="flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div class="w-full max-w-md">
            <div class="flex flex-col items-center text-center">
                <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#102840] text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-6"><path d="M12 2 4 6v6c0 5.5 3.4 9.7 8 10 4.6-.3 8-4.5 8-10V6Z"/><path d="m9 12 2 2 4-4"/></svg>
                </div>
                <h1 class="mt-4 text-2xl font-bold tracking-tight text-[#102840]">SecureCRM</h1>
                <p class="mt-1 text-sm text-[#667085]">MurihSpace support staff console</p>
            </div>

            <div class="mt-8 rounded-2xl border border-[#D6E0E8] bg-white p-8 shadow-sm">
                <h2 class="text-lg font-bold text-[#102840]">Sign in</h2>
                <p class="mt-1 text-[13px] text-[#98A2B3]">Use your staff account credentials.</p>

                @if ($errors->any())
                    <div class="mt-5 rounded-xl border border-[#DC2626]/20 bg-[#DC2626]/5 p-4">
                        <ul class="space-y-1 text-[13px] font-medium text-[#DC2626]">
                            @foreach ($errors->all() as $error)
                                <li>{{ $error }}</li>
                            @endforeach
                        </ul>
                    </div>
                @endif

                <form method="POST" action="{{ route('securecrm.login.submit') }}" class="mt-6 space-y-5">
                    @csrf

                    <div>
                        <label for="email" class="block text-[13px] font-semibold text-[#102840]">Email address</label>
                        <input
                            id="email" type="email" name="email" value="{{ old('email') }}" required autofocus autocomplete="username"
                            class="mt-1.5 w-full rounded-lg border border-[#D6E0E8] bg-white px-3.5 py-2.5 text-sm text-[#102840] placeholder:text-[#98A2B3] outline-none transition-colors focus:border-[#38A8D8] focus:ring-2 focus:ring-[#38A8D8]/20"
                            placeholder="agent@murihspace.com"
                        />
                    </div>

                    <div>
                        <div class="flex items-center justify-between">
                            <label for="password" class="block text-[13px] font-semibold text-[#102840]">Password</label>
                            <a href="#" class="text-[12px] font-medium text-[#2164b6] hover:underline">Forgot password?</a>
                        </div>
                        <input
                            id="password" type="password" name="password" required autocomplete="current-password"
                            class="mt-1.5 w-full rounded-lg border border-[#D6E0E8] bg-white px-3.5 py-2.5 text-sm text-[#102840] placeholder:text-[#98A2B3] outline-none transition-colors focus:border-[#38A8D8] focus:ring-2 focus:ring-[#38A8D8]/20"
                            placeholder="••••••••"
                        />
                    </div>

                    <label class="flex items-center gap-2 text-[13px] text-[#667085]">
                        <input type="checkbox" name="remember" value="1"
                            class="size-4 rounded border-[#D6E0E8] text-[#38A8D8] focus:ring-[#38A8D8]/30" />
                        Remember me
                    </label>

                    <button type="submit"
                        class="w-full rounded-lg bg-[#102840] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#0C2034] focus:ring-2 focus:ring-[#102840]/30">
                        Sign in to SecureCRM
                    </button>
                </form>
            </div>

            <p class="mt-6 text-center text-[12px] text-[#98A2B3]">
                Authorised staff only. All activity is audited.
            </p>
        </div>
    </div>
</body>
</html>