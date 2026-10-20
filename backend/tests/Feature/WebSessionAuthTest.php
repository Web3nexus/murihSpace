<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Symfony\Component\HttpFoundation\Cookie;
use Tests\TestCase;

class WebSessionAuthTest extends TestCase
{
    use RefreshDatabase;

    private const WEB_ORIGIN = 'https://web.test';

    protected function setUp(): void
    {
        parent::setUp();

        config(['sanctum.stateful' => ['web.test']]);
    }

    public function test_web_login_sets_httponly_session_cookie_and_returns_no_token(): void
    {
        $user = User::factory()->create();

        $response = $this->withHeader('Origin', self::WEB_ORIGIN)
            ->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password']);

        $response->assertOk();
        $this->assertNotNull($response->json('data.user'));
        $this->assertNull($response->json('data.token'));

        $cookie = $this->sessionCookie($response);
        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame(config('session.same_site'), 'lax');
    }

    public function test_session_authenticated_request_to_protected_route_succeeds(): void
    {
        $user = User::factory()->create();
        $login = $this->withHeader('Origin', self::WEB_ORIGIN)
            ->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password']);

        $response = $this->withSessionCookie($login)
            ->withHeader('Origin', self::WEB_ORIGIN)
            ->getJson('/api/v1/auth/sessions');

        $response->assertOk();
        $this->assertTrue($response->json('data.data.0.is_current'));
    }

    public function test_request_without_session_or_token_is_rejected(): void
    {
        $this->withHeader('Origin', self::WEB_ORIGIN)
            ->getJson('/api/v1/auth/sessions')
            ->assertUnauthorized();

        $this->getJson('/api/v1/auth/sessions')->assertUnauthorized();
    }

    public function test_mobile_bearer_login_still_returns_a_working_token(): void
    {
        $user = User::factory()->create();

        $login = $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password']);

        $login->assertOk();
        $token = $login->json('data.token');
        $this->assertIsString($token);

        $this->withHeader('Authorization', 'Bearer '.$token)
            ->getJson('/api/v1/auth/sessions')
            ->assertOk();
    }

    public function test_web_logout_invalidates_session_and_cookie(): void
    {
        $user = User::factory()->create();
        $login = $this->withHeader('Origin', self::WEB_ORIGIN)
            ->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password']);

        $logout = $this->withSessionCookie($login)
            ->withHeader('Origin', self::WEB_ORIGIN)
            ->postJson('/api/v1/auth/logout');

        $logout->assertOk();
        $this->assertSame(0, $user->tokens()->count());

        $this->withSessionCookie($login)
            ->withHeader('Origin', self::WEB_ORIGIN)
            ->getJson('/api/v1/auth/sessions')
            ->assertUnauthorized();
    }

    public function test_revoking_the_bound_token_ends_the_web_session(): void
    {
        $user = User::factory()->create();
        $login = $this->withHeader('Origin', self::WEB_ORIGIN)
            ->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password']);

        $user->tokens()->delete();

        $this->withSessionCookie($login)
            ->withHeader('Origin', self::WEB_ORIGIN)
            ->getJson('/api/v1/auth/sessions')
            ->assertUnauthorized();
    }

    private function sessionCookie(\Illuminate\Testing\TestResponse $response): ?Cookie
    {
        foreach ($response->headers->getCookies() as $cookie) {
            if ($cookie->getName() === config('session.cookie')) {
                return $cookie;
            }
        }

        return null;
    }

    private function withSessionCookie(\Illuminate\Testing\TestResponse $login): static
    {
        $cookie = $this->sessionCookie($login);
        $this->assertNotNull($cookie, 'Login did not set a session cookie.');

        // Each HTTP request is a fresh process in production. Drop cached guards
        // and the session store so state does not leak between test requests.
        $this->app['auth']->forgetGuards();
        $this->app->forgetInstance('session.store');

        return $this->withUnencryptedCookie($cookie->getName(), $cookie->getValue());
    }
}
