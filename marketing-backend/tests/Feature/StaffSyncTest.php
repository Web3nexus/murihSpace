<?php

namespace Tests\Feature;

use App\Jobs\SyncStaffAccountJob;
use App\Models\StaffUser;
use App\Providers\AppServiceProvider;
use App\Services\StaffSync\MainAdminMapping;
use App\Services\StaffSync\StaffSyncClient;
use App\Services\StaffSync\StaffSyncException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class StaffSyncTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'staff_sync.main_url' => 'https://main.example.test/',
            'staff_sync.internal_token' => 'shared-sync-token',
        ]);
    }

    public function test_sender_posts_the_main_backend_contract_with_signed_headers(): void
    {
        Http::fake(['main.example.test/internal/staff/sync' => Http::response(['status' => 'success'], 200)]);

        $staff = StaffUser::factory()->superAdmin()->create([
            'name' => 'Root',
            'email' => 'root@example.test',
        ]);

        app(StaffSyncClient::class)->push($staff);

        Http::assertSentCount(1);
        Http::assertSent(function (Request $request) use ($staff) {
            $body = $request->data();

            return $request->url() === 'https://main.example.test/internal/staff/sync'
                && $request->method() === 'POST'
                && $request->header('X-Internal-Token')[0] === 'shared-sync-token'
                && ctype_digit($request->header('X-Timestamp')[0])
                && abs((int) $request->header('X-Timestamp')[0] - time()) < 5
                && strlen($request->header('X-Nonce')[0]) >= 16
                && $body === [
                    'staff_identity_id' => (string) $staff->id,
                    'email' => 'root@example.test',
                    'name' => 'Root',
                    'role' => 'super_admin',
                    'status' => 'active',
                    'permissions' => MainAdminMapping::ALL_MAIN_PERMISSIONS,
                ]
                && is_string($body['staff_identity_id'])
                && ! array_key_exists('id', $body)
                && ! array_key_exists('password', $body);
        });
    }

    public function test_sync_body_uses_the_mapped_role_and_permissions_for_a_custom_grant(): void
    {
        Http::fake(['*' => Http::response(['status' => 'success'], 200)]);

        $staff = StaffUser::factory()->role('support_agent')->withPermissions(['ticket.view', 'kyc.summary.view'])->create();

        app(StaffSyncClient::class)->push($staff);

        Http::assertSent(fn (Request $request) => $request->data()['role'] === 'support_staff'
            && $request->data()['permissions'] === ['kyc', 'support']);
    }

    public function test_each_request_gets_a_fresh_nonce(): void
    {
        Http::fake(['*' => Http::response(['status' => 'success'], 200)]);
        $staff = StaffUser::factory()->create();

        app(StaffSyncClient::class)->push($staff);
        app(StaffSyncClient::class)->push($staff);

        $nonces = collect(Http::recorded())->map(fn ($pair) => $pair[0]->header('X-Nonce')[0])->unique();
        $this->assertCount(2, $nonces);
    }

    public function test_a_non_success_response_throws_so_the_queue_retries(): void
    {
        Http::fake(['*' => Http::response(['status' => 'error'], 503)]);
        $staff = StaffUser::factory()->create();

        $this->expectException(StaffSyncException::class);
        app(StaffSyncClient::class)->push($staff);
    }

    public function test_a_role_without_a_mapping_fails_before_anything_is_sent(): void
    {
        Http::fake();
        $staff = StaffUser::factory()->role('retired_role')->create();

        $this->expectException(StaffSyncException::class);
        try {
            app(StaffSyncClient::class)->push($staff);
        } finally {
            Http::assertNothingSent();
        }
    }

    public function test_missing_configuration_throws_instead_of_sending(): void
    {
        config(['staff_sync.main_url' => null]);
        Http::fake();

        $this->expectException(StaffSyncException::class);
        try {
            app(StaffSyncClient::class)->push(StaffUser::factory()->create());
        } finally {
            Http::assertNothingSent();
        }
    }

    public function test_disable_posts_only_the_staff_identity_id_to_the_disable_path(): void
    {
        Http::fake(['main.example.test/internal/staff/disable' => Http::response(['status' => 'success'], 200)]);
        $staff = StaffUser::factory()->create();

        $this->assertTrue(app(StaffSyncClient::class)->disable($staff));

        Http::assertSentCount(1);
        Http::assertSent(function (Request $request) use ($staff) {
            return $request->url() === 'https://main.example.test/internal/staff/disable'
                && $request->method() === 'POST'
                && $request->header('X-Internal-Token')[0] === 'shared-sync-token'
                && strlen($request->header('X-Nonce')[0]) >= 16
                && $request->data() === ['staff_identity_id' => (string) $staff->id];
        });
    }

    public function test_disable_for_an_account_the_main_backend_does_not_know_is_not_retried(): void
    {
        Http::fake(['*' => Http::response(['status' => 'error', 'code' => 'staff_not_found'], 404)]);

        $this->assertFalse(app(StaffSyncClient::class)->disable(StaffUser::factory()->create()));
    }

    public function test_disable_server_error_throws_so_the_queue_retries(): void
    {
        Http::fake(['*' => Http::response(['status' => 'error'], 500)]);

        $this->expectException(StaffSyncException::class);
        app(StaffSyncClient::class)->disable(StaffUser::factory()->create());
    }

    public function test_job_pushes_an_active_account_and_disables_a_disabled_one(): void
    {
        Http::fake(['*' => Http::response(['status' => 'success'], 200)]);

        $active = StaffUser::factory()->create();
        (new SyncStaffAccountJob($active->id))->handle(app(StaffSyncClient::class));

        $disabled = StaffUser::factory()->inactive()->create();
        (new SyncStaffAccountJob($disabled->id))->handle(app(StaffSyncClient::class));

        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/internal/staff/sync')
            && $r->data()['staff_identity_id'] === (string) $active->id);
        Http::assertSent(fn (Request $r) => str_ends_with($r->url(), '/internal/staff/disable')
            && $r->data() === ['staff_identity_id' => (string) $disabled->id]);
    }

    public function test_production_refuses_to_boot_without_sync_configuration(): void
    {
        config(['staff_sync.main_url' => null, 'staff_sync.internal_token' => null]);
        $this->app->detectEnvironment(fn () => 'production');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('STAFF_SYNC_MAIN_URL, STAFF_SYNC_INTERNAL_TOKEN');

        (new AppServiceProvider($this->app))->boot();
    }

    public function test_production_boots_when_sync_configuration_is_present(): void
    {
        config(['staff_ads.hub_secret' => 'test-hub-secret-value-000000000000']);
        $this->app->detectEnvironment(fn () => 'production');

        (new AppServiceProvider($this->app))->boot();

        $this->assertTrue(true);
    }
}
