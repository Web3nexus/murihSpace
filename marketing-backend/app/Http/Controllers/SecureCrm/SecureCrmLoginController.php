<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Services\AuditLogService;
use App\Services\StaffAuthenticator;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class SecureCrmLoginController extends Controller
{
    public function __construct(protected StaffAuthenticator $authenticator) {}

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

        // Same path as the API login: failed attempts count per account, the
        // account locks after max_attempts, and disabled accounts are refused.
        $staff = $this->authenticator->attempt($credentials['email'], $credentials['password'], $request);

        if ($staff === null) {
            // One message for every refusal so the form does not reveal which.
            throw ValidationException::withMessages([
                'email' => 'These credentials do not match our records.',
            ]);
        }

        Auth::guard('staff')->login($staff, $request->boolean('remember'));

        app(AuditLogService::class)->record(
            AuditLog::LOGIN,
            actor: $staff,
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
