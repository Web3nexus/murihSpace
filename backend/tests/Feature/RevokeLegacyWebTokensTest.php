<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class RevokeLegacyWebTokensTest extends TestCase
{
    use RefreshDatabase;

    private const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15';
    private const MOBILE_UA = 'Dart/3.5 (dart:io)';

    private User $user;

    /** @var array<string, int> */
    private array $ids = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();

        $this->ids['web_one'] = $this->token('auth-token', self::BROWSER_UA);
        $this->ids['web_two'] = $this->token('auth-token', self::BROWSER_UA);
        $this->ids['mobile'] = $this->token('auth-token', self::MOBILE_UA);
        $this->ids['no_agent'] = $this->token('auth-token', null);
        $this->ids['admin_browser'] = $this->token('admin-token', self::BROWSER_UA);
        $this->ids['impersonation_browser'] = $this->token('impersonation-token', self::BROWSER_UA);
    }

    public function test_dry_run_reports_the_count_and_deletes_nothing(): void
    {
        $this->artisan('tokens:revoke-legacy-web')
            ->expectsOutputToContain('Legacy web tokens to revoke : 2')
            ->expectsOutputToContain('Dry run')
            ->assertSuccessful();

        $this->assertSame(6, PersonalAccessToken::count());
    }

    public function test_force_deletes_only_the_legacy_web_tokens(): void
    {
        $this->artisan('tokens:revoke-legacy-web', ['--force' => true])
            ->expectsOutputToContain('Revoked 2 legacy web token(s).')
            ->assertSuccessful();

        $this->assertNull(PersonalAccessToken::find($this->ids['web_one']));
        $this->assertNull(PersonalAccessToken::find($this->ids['web_two']));
    }

    public function test_force_leaves_mobile_tokens_and_other_token_kinds_alone(): void
    {
        $this->artisan('tokens:revoke-legacy-web', ['--force' => true])->assertSuccessful();

        $this->assertNotNull(PersonalAccessToken::find($this->ids['mobile']), 'Mobile token must survive.');
        $this->assertNotNull(PersonalAccessToken::find($this->ids['no_agent']), 'Unrecorded agent must not be assumed web.');
        $this->assertNotNull(PersonalAccessToken::find($this->ids['admin_browser']));
        $this->assertNotNull(PersonalAccessToken::find($this->ids['impersonation_browser']));
    }

    private function token(string $name, ?string $userAgent): int
    {
        $token = $this->user->createToken($name, ['*'])->accessToken;
        $token->forceFill(['user_agent' => $userAgent])->save();

        return $token->id;
    }
}
