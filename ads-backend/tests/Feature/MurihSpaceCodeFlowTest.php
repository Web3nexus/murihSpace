<?php

namespace Tests\Feature;

use App\Models\AdAccount;
use App\Models\AdAccountMember;
use App\Models\Advertiser;
use App\Models\Campaign;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * "Continue with MurihSpace" completion. The main backend is faked at the HTTP
 * boundary. Covers the exchange contract (headers, body, error mapping) and the
 * local sign-in: single-use guard, advertiser find-or-create keyed on the
 * MurihSpace user id.
 */
class MurihSpaceCodeFlowTest extends TestCase
{
    use RefreshDatabase;

    private const SSO = 'https://sso.test';
    private const INTERNAL_TOKEN = 'internal-test-token';
    private const REDIRECT = 'https://ads.test/auth/sso/callback';
    private const EXCHANGE = self::SSO.'/internal/ads/sso/exchange';
    private const CODE = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEF';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'services.murihspace.sso_base_url' => self::SSO,
            'services.murihspace.internal_token' => self::INTERNAL_TOKEN,
            'services.murihspace.redirect_uri' => self::REDIRECT,
        ]);
    }

    /** @param array<string, mixed> $user */
    private function exchangeSucceeds(array $user = []): void
    {
        Http::fake([
            self::EXCHANGE => Http::response([
                'status' => 'success',
                'data' => [
                    'user' => array_merge([
                        'id' => 77,
                        'name' => 'Creator One',
                        'username' => 'creatorone',
                        'avatar_url' => 'https://cdn.sso.test/a.png',
                    ], $user),
                    'sync' => ['status' => 'synced', 'key' => 'murihspace_user_id'],
                ],
            ], 200),
        ]);
    }

    private function exchangeFails(int $status, string $code): void
    {
        Http::fake([
            self::EXCHANGE => Http::response(['status' => 'error', 'code' => $code, 'message' => 'x'], $status),
        ]);
    }

    private function complete(string $code = self::CODE)
    {
        return $this->postJson('/api/auth/murihspace/complete', ['code' => $code]);
    }

    public function test_exchange_is_server_to_server_with_internal_headers_and_the_configured_redirect(): void
    {
        $this->exchangeSucceeds();

        $this->complete()->assertOk();

        Http::assertSentCount(1);
        Http::assertSent(function (HttpRequest $request) {
            return $request->url() === self::EXCHANGE
                && $request->header('X-Internal-Token')[0] === self::INTERNAL_TOKEN
                && ctype_digit($request->header('X-Timestamp')[0])
                && strlen($request->header('X-Nonce')[0]) >= 16
                && strlen($request->header('X-Nonce')[0]) <= 128
                && $request['code'] === self::CODE
                && $request['redirect_uri'] === self::REDIRECT
                && ! array_key_exists('client_secret', $request->data());
        });
    }

    public function test_a_reused_code_is_rejected_without_a_second_exchange(): void
    {
        $this->exchangeSucceeds();

        $this->complete()->assertOk();

        $this->complete()
            ->assertStatus(401)
            ->assertJsonPath('code', 'invalid_code');

        Http::assertSentCount(1);
        $this->assertSame(1, User::count());
    }

    public function test_a_transient_exchange_failure_lets_the_same_code_be_retried(): void
    {
        Http::fake([
            self::EXCHANGE => Http::sequence()
                ->push(['status' => 'error', 'code' => 'internal_error', 'message' => 'x'], 503)
                ->push(['status' => 'success', 'data' => ['user' => ['id' => 77, 'name' => 'Creator One']]], 200),
        ]);

        $this->complete()
            ->assertStatus(502)
            ->assertJsonPath('code', 'sso_unavailable');

        $this->complete()
            ->assertOk()
            ->assertJsonPath('status', 'success');
    }

    public function test_a_redirect_mismatch_from_the_main_backend_is_rejected(): void
    {
        $this->exchangeFails(422, 'redirect_mismatch');

        $this->complete()
            ->assertStatus(422)
            ->assertJsonPath('code', 'redirect_mismatch');

        $this->assertDatabaseMissing('advertisers', ['murihspace_user_id' => 77]);
        $this->assertDatabaseMissing('users', ['murihspace_user_id' => 77]);
    }

    public function test_an_expired_code_is_rejected(): void
    {
        $this->exchangeFails(401, 'invalid_code');

        $this->complete()
            ->assertStatus(401)
            ->assertJsonPath('code', 'invalid_code');

        $this->assertDatabaseMissing('advertisers', ['murihspace_user_id' => 77]);
    }

    public function test_an_ineligible_account_is_refused(): void
    {
        $this->exchangeFails(403, 'ads_upgrade_required');

        $this->complete()->assertStatus(403);

        $this->assertDatabaseMissing('advertisers', ['murihspace_user_id' => 77]);
    }

    public function test_missing_internal_token_refuses_without_calling_the_main_backend(): void
    {
        config(['services.murihspace.internal_token' => '']);
        Http::fake();

        $this->complete()->assertStatus(503);

        Http::assertNothingSent();
    }

    public function test_first_sign_in_creates_the_advertiser_and_returns_a_session_token(): void
    {
        $this->exchangeSucceeds();

        $response = $this->complete()->assertOk();

        $response->assertJsonPath('status', 'success')
            ->assertJsonPath('user.username', 'creatorone')
            ->assertJsonMissingPath('user.email');

        $advertiser = Advertiser::where('murihspace_user_id', 77)->sole();
        $this->assertSame('Creator One Studio', $advertiser->business_name);
        $this->assertDatabaseHas('users', ['murihspace_user_id' => 77, 'name' => 'Creator One', 'email' => null]);
        $this->assertDatabaseHas('ad_accounts', ['advertiser_id' => $advertiser->id]);
        $this->assertDatabaseHas('ad_wallets', ['advertiser_id' => $advertiser->id]);

        $this->assertNotEmpty($response->json('token'));
        $this->withToken($response->json('token'))
            ->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('murihspace_user_id', 77);
    }

    public function test_a_murihspace_sign_in_never_matches_an_existing_account_by_email(): void
    {
        // A pre-existing local account with the same email as the MurihSpace
        // profile. Email is not an identity key, so it must be left untouched.
        $legacy = new User;
        $legacy->forceFill([
            'name' => 'Legacy Email Account',
            'email' => 'creator@example.com',
            'password' => Hash::make('unused'),
        ])->save();

        // The exchange returns no email; even if one were sent it is ignored.
        $this->exchangeSucceeds(['email' => 'creator@example.com']);

        $response = $this->complete()
            ->assertOk()
            ->assertJsonMissingPath('user.email');

        $this->assertNotSame($legacy->id, $response->json('user.id'));
        $this->assertDatabaseHas('users', ['id' => $legacy->id, 'murihspace_user_id' => null, 'email' => 'creator@example.com']);
        $this->assertDatabaseHas('users', ['murihspace_user_id' => 77, 'email' => null]);
        $this->assertSame(2, User::count());
    }

    public function test_second_sign_in_links_to_the_same_advertiser(): void
    {
        $this->exchangeSucceeds();
        $this->complete()->assertOk();
        $firstId = Advertiser::where('murihspace_user_id', 77)->sole()->id;

        $this->complete('zyxwvutsrqponmlkjihgfedcba9876543210ZYXW')->assertOk();

        $this->assertSame(1, Advertiser::where('murihspace_user_id', 77)->count());
        $this->assertSame(1, User::where('murihspace_user_id', 77)->count());
        $this->assertSame($firstId, Advertiser::where('murihspace_user_id', 77)->sole()->id);
    }

    public function test_sso_user_only_sees_ad_accounts_of_its_murihspace_id_when_local_ids_differ(): void
    {
        // Another MurihSpace user (id 1) owns a campaign. The SSO user below is
        // the first local user, so its local id is 1 while its MurihSpace id is 77.
        $other = Advertiser::create([
            'murihspace_user_id' => 1,
            'business_name' => 'Other Business',
            'country' => 'US',
            'currency' => 'USD',
            'timezone' => 'UTC',
        ]);
        $otherAccount = AdAccount::create([
            'advertiser_id' => $other->id,
            'name' => 'Other Ad Account',
            'currency' => 'USD',
            'timezone' => 'UTC',
            'status' => 'active',
        ]);
        AdAccountMember::create([
            'ad_account_id' => $otherAccount->id,
            'murihspace_user_id' => 1,
            'role' => 'owner',
        ]);
        $this->campaign($otherAccount->id, $other->id, 'Foreign Campaign');

        $this->exchangeSucceeds();
        $response = $this->complete()->assertOk();
        $this->assertSame(1, $response->json('user.id'));

        $own = Advertiser::where('murihspace_user_id', 77)->sole();
        $ownAccount = AdAccount::where('advertiser_id', $own->id)->sole();
        $this->campaign($ownAccount->id, $own->id, 'Own Campaign');

        $this->withToken($response->json('token'))
            ->getJson('/api/campaigns')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Own Campaign');
    }

    private function campaign(int $adAccountId, int $advertiserId, string $name): void
    {
        Campaign::create([
            'ad_account_id' => $adAccountId,
            'advertiser_id' => $advertiserId,
            'name' => $name,
            'objective' => 'traffic',
            'status' => 'active',
            'budget_type' => 'daily',
            'budget_amount' => 50,
        ]);
    }
}
