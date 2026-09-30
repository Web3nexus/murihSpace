<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use App\Services\MemberEnforcementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * The marketing console as a client of the main backend's enforcement API.
 *
 * These tests cover the client contract only. The decision logic — the warning
 * gate, the permission check, the ban — lives in the main backend and is tested
 * in its own suite; duplicating it here would test a copy that can drift.
 */
class MemberEnforcementServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Cache::flush();
        config([
            'services.main_backend.base_url' => 'http://backend.test',
            'services.main_backend.token' => 'secret-token',
        ]);
    }

    private function staff(): StaffUser
    {
        return StaffUser::factory()->create(['email' => 'agent@murihspace.test']);
    }

    public function test_a_warning_request_sends_the_acting_staff_email(): void
    {
        Http::fake([
            'backend.test/internal/enforcement/warn' => Http::response([
                'success' => true,
                'data' => ['warning_id' => 5, 'status' => 'active'],
            ], 201),
        ]);

        $result = app(MemberEnforcementService::class)->warn($this->staff(), 42, 'Abusive language.');

        $this->assertTrue($result['ok']);
        $this->assertSame(5, $result['warning_id']);

        Http::assertSent(function (Request $request) {
            $body = $request->data();

            return $body['actor_email'] === 'agent@murihspace.test'
                && $body['user_id'] === 42
                && $body['reason'] === 'Abusive language.';
        });
    }

    public function test_enforcement_requests_are_signed(): void
    {
        Http::fake([
            'backend.test/internal/enforcement/warn' => Http::response(['success' => true], 201),
        ]);

        app(MemberEnforcementService::class)->warn($this->staff(), 1, 'x');

        Http::assertSent(function (Request $request) {
            return ($request->header('X-Internal-Token')[0] ?? '') === 'secret-token'
                && ($request->header('X-Timestamp')[0] ?? '') !== ''
                && strlen((string) ($request->header('X-Nonce')[0] ?? '')) === 32;
        });
    }

    public function test_the_warning_gate_is_surfaced_to_the_caller_not_swallowed(): void
    {
        Http::fake([
            'backend.test/internal/enforcement/ban' => Http::response([
                'success' => false,
                'message' => 'This member has no active warning on record.',
                'errors' => ['code' => 'warning_required'],
            ], 422),
        ]);

        $result = app(MemberEnforcementService::class)->ban($this->staff(), 9, 'Direct ban attempt.');

        $this->assertFalse($result['ok']);
        // The caller needs this distinction to prompt the operator to warn
        // first; a bare failure would look like a transport problem worth
        // retrying.
        $this->assertSame('warning_required', $result['code']);
    }

    public function test_a_transport_failure_never_reports_success(): void
    {
        Http::fake([
            'backend.test/*' => Http::response('', 500),
        ]);

        $result = app(MemberEnforcementService::class)->warn($this->staff(), 3, 'x');

        $this->assertFalse($result['ok']);
    }

    public function test_an_unconfigured_main_backend_reports_the_problem_rather_than_silently_succeeding(): void
    {
        config(['services.main_backend.token' => '']);

        $result = app(MemberEnforcementService::class)->warn($this->staff(), 3, 'x');

        $this->assertFalse($result['ok']);
        $this->assertStringContainsString('not configured', $result['message']);
    }

    public function test_a_ban_can_declare_an_emergency(): void
    {
        Http::fake([
            'backend.test/internal/enforcement/ban' => Http::response([
                'success' => true,
                'data' => ['status' => 'banned'],
            ], 200),
        ]);

        app(MemberEnforcementService::class)->ban($this->staff(), 3, 'Active fraud.', ['ban_type' => 'emergency']);

        Http::assertSent(fn (Request $request) => ($request->data()['ban_type'] ?? null) === 'emergency');
    }

    public function test_a_report_can_be_flagged(): void
    {
        Http::fake([
            'backend.test/internal/enforcement/flag-report' => Http::response([
                'success' => true,
                'data' => ['report_id' => 11, 'status' => 'flagged'],
            ], 200),
        ]);

        $result = app(MemberEnforcementService::class)->flagReport($this->staff(), 11, 'Needs a second look.');

        $this->assertTrue($result['ok']);
        $this->assertSame('flagged', $result['status']);
    }

    public function test_the_authoritative_status_is_taken_from_the_main_backend(): void
    {
        Http::fake([
            'backend.test/internal/enforcement/ban' => Http::response([
                'success' => true,
                'data' => ['user_id' => 3, 'status' => 'banned'],
            ], 200),
        ]);

        $result = app(MemberEnforcementService::class)->ban($this->staff(), 3, 'Escalation.');

        // DEC-011: the main backend's value is what the console renders.
        $this->assertSame('banned', $result['status']);
    }
}
