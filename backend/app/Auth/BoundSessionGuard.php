<?php

namespace App\Auth;

use App\Support\WebSession;
use Illuminate\Auth\SessionGuard;

/**
 * The web session guard, which refuses a session whose token has been revoked.
 *
 * Every caller resolves the user through user(), including Sanctum's guard for
 * auth:sanctum routes. Checking here means a revoked or expired web session
 * stops authenticating on the next request without depending on middleware
 * order.
 */
class BoundSessionGuard extends SessionGuard
{
    private bool $checkingLiveness = false;

    public function user()
    {
        $user = parent::user();

        if ($user === null || $this->checkingLiveness || ! $this->request?->hasSession()) {
            return $user;
        }

        if (WebSession::isLive($this->request, $user)) {
            return $user;
        }

        // logout() resolves the user again, so the guard is re-entered; the flag stops that loop.
        $this->checkingLiveness = true;
        try {
            WebSession::end($this->request);
        } finally {
            $this->checkingLiveness = false;
        }

        return null;
    }
}
