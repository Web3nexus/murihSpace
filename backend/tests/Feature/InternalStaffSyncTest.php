<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\RateLimiter;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class InternalStaffSyncTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private const TOKEN = 'test-internal-token';
    private const STAFF_ID = 'stf_01HZX0000000000000000001';

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('internal.token', self::TOKEN);
        Config::set('internal.allowed_ips', []);
        Config::set('internal.replay_window', 300);
        Config::set('internal.rate_limit', ['attempts' => 300, 'decay' => 60]);
        RateLimiter::clear('internal-api:'.sha1(self::TOKEN));
    }

    private function headers(?string $nonce = null, ?int $timestamp = null): array
    {
        return [
            'X-Internal-Token' => self::TOKEN,
            'X-Timestamp' => (string) ($timestamp ?? now()->getTimestamp()),
            'X-Nonce' => $nonce ?? bin2hex(random_bytes(16)),
            'Accept' => 'application/json',
        ];
    }

    private function record(array $overrides = []): array
    {
        return array_merge([
            'staff_identity_id' => self::STAFF_ID,
            'email' => 'ada.staff@murihspace.test',
            'name' => 'Ada Staff',
            'role' => 'finance_admin',
            'status' => 'active',
            'permissions' => ['fees', 'payouts'],
        ], $overrides);
    }

    public function test_a_sync_creates_an_admin_without_a_password(): void
    {
        $response = $this->postJson('/internal/staff/sync', $this->record(), $this->headers());

        $response->assertCreated()
            ->assertJsonPath('created', true)
            ->assertJsonPath('data.staff_identity_id', self::STAFF_ID)
            ->assertJsonPath('data.role', 'finance_admin')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.permissions', ['fees', 'payouts']);

        $this->assertArrayNotHasKey('password', $response->json('data'));
        $this->assertStringNotContainsString('password', strtolower($response->getContent()));

        $user = User::where('staff_identity_id', self::STAFF_ID)->firstOrFail();
        $this->assertSame('admin', $user->role);
        $this->assertSame('finance_admin', $user->admin_role);
        $this->assertSame(['fees', 'payouts'], $user->admin_permissions);
        $this->assertNull($user->getRawOriginal('password'));
    }

    public function test_a_second_push_updates_the_same_account_without_duplicating_it(): void
    {
        $first = $this->postJson('/internal/staff/sync', $this->record(), $this->headers())->assertCreated();

        $second = $this->postJson('/internal/staff/sync', $this->record([
            'name' => 'Ada Lovelace',
            'email' => 'ada.new@murihspace.test',
            'role' => 'support_admin',
            'permissions' => ['support'],
        ]), $this->headers())->assertOk()->assertJsonPath('created', false);

        $this->assertSame($first->json('data.user_id'), $second->json('data.user_id'));
        $this->assertSame(1, User::where('staff_identity_id', self::STAFF_ID)->count());

        $user = User::where('staff_identity_id', self::STAFF_ID)->firstOrFail();
        $this->assertSame('Ada Lovelace', $user->name);
        $this->assertSame('ada.new@murihspace.test', $user->email);
        $this->assertSame('support_admin', $user->admin_role);
        $this->assertSame(['support'], $user->admin_permissions);
    }

    public function test_a_disabled_push_blocks_admin_routes(): void
    {
        $this->postJson('/internal/staff/sync', $this->record(), $this->headers())->assertCreated();
        $staff = User::where('staff_identity_id', self::STAFF_ID)->firstOrFail();

        $this->actingAsSession($staff)->getJson('/api/v1/securegate/me')->assertOk();

        $this->postJson('/internal/staff/sync', $this->record(['status' => 'disabled']), $this->headers())
            ->assertOk()
            ->assertJsonPath('data.status', 'disabled');

        // The push revoked the account's tokens, and the account is suspended, so a fresh session is refused.
        $this->assertSame(0, $staff->fresh()->tokens()->count());
        $this->actingAsSession($staff)->getJson('/api/v1/securegate/me')
            ->assertForbidden()
            ->assertJsonPath('errors.code', 'admin_account_disabled');
    }

    public function test_a_disabled_account_is_refused_even_with_a_token_it_already_holds(): void
    {
        $staff = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'finance_admin',
            'admin_permissions' => ['fees'],
            'staff_identity_id' => self::STAFF_ID,
        ]);

        $this->actingAsSession($staff)->getJson('/api/v1/securegate/me')->assertOk();

        $staff->forceFill(['status' => 'suspended'])->save();

        $this->actingAsSession($staff)->getJson('/api/v1/securegate/me')
            ->assertForbidden()
            ->assertJsonPath('errors.code', 'admin_account_disabled');
    }

    public function test_the_disable_path_removes_access_without_deleting_the_account(): void
    {
        $this->postJson('/internal/staff/sync', $this->record(), $this->headers())->assertCreated();
        $staff = User::where('staff_identity_id', self::STAFF_ID)->firstOrFail();

        $this->postJson('/internal/staff/disable', ['staff_identity_id' => self::STAFF_ID], $this->headers())
            ->assertOk()
            ->assertJsonPath('data.status', 'disabled');

        $this->assertSame('suspended', $staff->fresh()->status);
        $this->assertNotNull(User::find($staff->id));

        $this->postJson('/internal/staff/disable', ['staff_identity_id' => 'stf_unknown'], $this->headers())
            ->assertNotFound()
            ->assertJsonPath('code', 'staff_not_found');
    }

    public function test_a_sync_never_adopts_an_existing_consumer_account_by_email(): void
    {
        $consumer = User::factory()->create(['email' => 'ada.staff@murihspace.test', 'role' => 'member']);

        $this->postJson('/internal/staff/sync', $this->record(), $this->headers())
            ->assertStatus(409)
            ->assertJsonPath('code', 'email_in_use');

        $this->assertSame('member', $consumer->fresh()->role);
        $this->assertNull($consumer->fresh()->staff_identity_id);
    }

    public function test_a_request_without_a_valid_internal_token_is_rejected(): void
    {
        $this->postJson('/internal/staff/sync', $this->record(), array_merge($this->headers(), ['X-Internal-Token' => 'wrong']))
            ->assertForbidden();

        $headers = $this->headers();
        unset($headers['X-Internal-Token']);
        $this->postJson('/internal/staff/sync', $this->record(), $headers)->assertForbidden();

        $this->assertDatabaseMissing('users', ['staff_identity_id' => self::STAFF_ID]);
    }

    public function test_a_replayed_nonce_is_rejected(): void
    {
        $headers = $this->headers('replayed-nonce-0000000001');

        $this->postJson('/internal/staff/sync', $this->record(), $headers)->assertCreated();

        $this->postJson('/internal/staff/sync', $this->record(['name' => 'Changed']), $headers)
            ->assertStatus(400);

        $this->assertSame('Ada Staff', User::where('staff_identity_id', self::STAFF_ID)->value('name'));
    }

    public function test_a_stale_timestamp_is_rejected(): void
    {
        $this->postJson('/internal/staff/sync', $this->record(), $this->headers(null, now()->subHour()->getTimestamp()))
            ->assertStatus(400);

        $this->assertDatabaseMissing('users', ['staff_identity_id' => self::STAFF_ID]);
    }

    public function test_the_sync_rejects_unknown_roles_and_permissions(): void
    {
        $this->postJson('/internal/staff/sync', $this->record(['role' => 'god_mode']), $this->headers())
            ->assertUnprocessable();

        $this->postJson('/internal/staff/sync', $this->record(['permissions' => ['nuke']]), $this->headers())
            ->assertUnprocessable();

        $this->postJson('/internal/staff/sync', $this->record(['permissions' => []]), $this->headers())
            ->assertUnprocessable();

        $this->assertDatabaseMissing('users', ['staff_identity_id' => self::STAFF_ID]);
    }
}
