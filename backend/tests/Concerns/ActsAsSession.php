<?php

namespace Tests\Concerns;

use App\Models\User;
use App\Support\AdminSession;
use Laravel\Sanctum\Sanctum;

/**
 * Signs a test in the way the request would really arrive.
 *
 * Members can keep using whatever mechanism the test already used. Administrators
 * cannot. IsAdmin discriminates a session by its provenance — the token name —
 * rather than by the caller's role, because that is precisely the property the
 * check exists to enforce, so an admin test has to present a token of the kind
 * AdminAuthController issues after a second factor.
 *
 * Sanctum::actingAs() and TestCase::actingAs() cannot stand in for that. The
 * first installs a TransientToken, which has no name and reports can() === true
 * for every ability; the second leaves currentAccessToken() null. Either way
 * there is no session for IsAdmin to recognise, so the test would be exercising
 * a path that does not exist in production — and would keep passing after a
 * regression that closed the real one.
 *
 * The two methods here differ only in what they delegate to for a member, so
 * that swapping a test onto this helper does not silently change how its
 * non-admin cases authenticate.
 */
trait ActsAsSession
{
    /**
     * Drop-in for Sanctum::actingAs().
     *
     * Returns the test case rather than the user, so that call sites written as
     * `$this->actingAs($u)->getJson(...)` keep working unchanged.
     *
     * @param  array<int, string>  $abilities
     */
    protected function actAsSession(?User $user = null, array $abilities = ['*']): static
    {
        $user ??= User::factory()->create();

        if ($user->role === 'admin') {
            $this->presentAdminToken($user);
        } else {
            Sanctum::actingAs($user, $abilities);
        }

        return $this;
    }

    /**
     * Drop-in for TestCase::actingAs(), including its fluent return so that
     * `$this->actingAs($u)->postJson(...)` call sites are untouched.
     *
     * @param  string|array<int, string>|null  $guard
     */
    protected function actingAsSession(?User $user = null, string|array|null $guard = null): static
    {
        $user ??= User::factory()->create();

        if ($user->role === 'admin') {
            $this->presentAdminToken($user);
        } else {
            $this->actingAs($user, $guard);
        }

        return $this;
    }

    /**
     * Mint a real administration token and present it for the rest of the test.
     *
     * withHeader() mutates the test case, so later requests in the same test
     * carry the token without every call site repeating it.
     */
    private function presentAdminToken(User $admin): void
    {
        $this->app['auth']->forgetGuards();

        $plain = $admin->createToken(AdminSession::TOKEN_NAME, ['*', AdminSession::ABILITY_MFA])
            ->plainTextToken;

        $this->withHeader('Authorization', 'Bearer '.$plain);
    }
}
