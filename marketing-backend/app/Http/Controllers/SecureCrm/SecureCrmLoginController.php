<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\AuditLogService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class SecureCrmLoginController extends Controller
{
    public function showLogin(): View
    {
        return view('securecrm.auth.login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $throttleKey = Str::lower($credentials['email']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            throw ValidationException::withMessages([
                'email' => 'Too many login attempts. Try again in '
                    .RateLimiter::availableIn($throttleKey).' seconds.',
            ]);
        }

        $remember = $request->boolean('remember');

        if (! Auth::guard('staff')->attempt($credentials, $remember)) {
            RateLimiter::hit($throttleKey, 60);

            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        RateLimiter::clear($throttleKey);

        $staff = Auth::guard('staff')->user();

        if (! $staff->is_active) {
            Auth::guard('staff')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => 'This staff account is deactivated. Contact an administrator.',
            ]);
        }

        $staff->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();

        app(AuditLogService::class)->record(
            AuditLog::LOGIN,
            subject_reference: $staff->email,
            after: ['ip' => $request->ip()],
        );

        $request->session()->regenerate();

        return redirect()->intended(route('securecrm.overview'));
    }

    public function logout(Request $request): RedirectResponse
    {
        $staff = $request->user('staff');

        Auth::guard('staff')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        app(AuditLogService::class)->record(
            AuditLog::LOGOUT,
            actor: $staff,
            subject_reference: $staff?->email,
        );

        return redirect()->route('securecrm.login');
    }
}
