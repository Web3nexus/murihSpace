<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\CmsContent;
use App\Models\HelpArticle;
use App\Models\SlaPolicy;
use App\Models\StaffUser;
use App\Models\Ticket;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SecureCrmAuditTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.main_backend.base_url' => 'http://backend.test', 'services.main_backend.token' => 'secret-token']);
    }

    private function fakeBackend(int $userId = 7): void
    {
        $user = ['id' => $userId, 'name' => 'Pearl', 'email' => 'pearl@example.com', 'status' => 'active', 'role' => 'creator', 'kyc_status' => 'verified'];

        Http::fake([
            'backend.test/internal/support/users/by-email/*' => Http::response(['success' => true, 'data' => $user], 200),
            'backend.test/internal/support/users/*/summary' => Http::response(['success' => true, 'data' => $user], 200),
            'backend.test/internal/support/users/*/orders' => Http::response(['success' => true, 'data' => []], 200),
            'backend.test/internal/support/users/*/subscriptions' => Http::response(['success' => true, 'data' => []], 200),
            'backend.test/internal/support/users/*/wallet-summary' => Http::response(['success' => true, 'data' => ['wallets' => [], 'creator_wallet' => null]], 200),
            'backend.test/internal/support/users/*/kyc-summary' => Http::response(['success' => true, 'data' => ['verifications' => [['provider' => 'smile', 'status' => 'verified', 'completed_at' => '2026-07-01T00:00:00.000000Z']]]], 200),
            'backend.test/internal/support/users/*/transactions' => Http::response(['success' => true, 'data' => []], 200),
        ]);
    }

    public function test_audit_page_renders_for_admin(): void
    {
        $admin = StaffUser::factory()->admin()->create();

        $this->actingAs($admin, 'staff')
            ->get('/securecrm/audit')
            ->assertOk()
            ->assertSee('Audit Logs')
            ->assertSee('All actions')
            ->assertSee('No audit entries found');
    }

    public function test_audit_page_forbidden_without_permission(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/audit')
            ->assertForbidden();
    }

    public function test_successful_login_writes_audit_entry(): void
    {
        $staff = StaffUser::factory()->create(['email' => 'agent@example.com', 'password' => bcrypt('password')]);

        $this->post('/securecrm/login', ['email' => 'agent@example.com', 'password' => 'password'])
            ->assertRedirect();

        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::LOGIN,
            'staff_user_id' => $staff->id,
            'subject_reference' => 'agent@example.com',
        ]);
    }

    public function test_ticket_view_writes_audit_entry(): void
    {
        $admin = StaffUser::factory()->admin()->create();
        $ticket = Ticket::factory()->forUser()->create();

        $this->actingAs($admin, 'staff')
            ->get("/securecrm/tickets/{$ticket->id}")
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::TICKET_VIEW,
            'staff_user_id' => $admin->id,
            'subject_id' => $ticket->id,
            'subject_reference' => $ticket->ticket_number,
        ]);
    }

    public function test_ticket_reassignment_writes_audit_entry(): void
    {
        $admin = StaffUser::factory()->admin()->create();
        $agent = StaffUser::factory()->create();
        $ticket = Ticket::factory()->forUser()->create();

        $this->actingAs($admin, 'staff')
            ->post("/securecrm/tickets/{$ticket->id}/assign", ['assigned_agent_id' => $agent->id])
            ->assertRedirect();

        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::TICKET_ASSIGN,
            'staff_user_id' => $admin->id,
            'subject_id' => $ticket->id,
            'subject_reference' => $ticket->ticket_number,
        ]);

        $log = AuditLog::where('action', AuditLog::TICKET_ASSIGN)->first();
        $this->assertSame(['assigned_agent_id' => null], $log->before);
        $this->assertSame(['assigned_agent_id' => $agent->id], $log->after);
    }

    public function test_customer_profile_and_kyc_access_writes_audit_entries(): void
    {
        $this->fakeBackend();

        $admin = StaffUser::factory()->admin()->create();

        $this->actingAs($admin, 'staff')
            ->get('/securecrm/customers/pearl%40example.com')
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::CUSTOMER_PROFILE_VIEW,
            'staff_user_id' => $admin->id,
            'subject_reference' => 'pearl@example.com',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::CUSTOMER_INTERNAL_LOOKUP,
            'staff_user_id' => $admin->id,
            'subject_reference' => 'pearl@example.com',
        ]);
        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::KYC_VIEW,
            'staff_user_id' => $admin->id,
            'subject_reference' => 'pearl@example.com',
        ]);
    }

    public function test_help_publish_writes_audit_entry(): void
    {
        $admin = StaffUser::factory()->admin()->create();
        $article = HelpArticle::factory()->create(['state' => 'draft']);

        $this->actingAs($admin, 'staff')
            ->post("/securecrm/help/{$article->id}/publish")
            ->assertRedirect();

        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::HELP_PUBLISH,
            'staff_user_id' => $admin->id,
            'subject_id' => $article->id,
            'subject_reference' => $article->title,
        ]);
    }

    public function test_cms_publish_writes_audit_entry(): void
    {
        $admin = StaffUser::factory()->admin()->create();
        $cms = CmsContent::factory()->create(['state' => 'draft', 'section' => 'home']);

        $this->actingAs($admin, 'staff')
            ->post("/securecrm/cms/{$cms->id}/publish")
            ->assertRedirect();

        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::CMS_PUBLISH,
            'staff_user_id' => $admin->id,
            'subject_id' => $cms->id,
        ]);
    }

    public function test_sla_update_writes_audit_entry(): void
    {
        $admin = StaffUser::factory()->admin()->create();
        $policy = SlaPolicy::factory()->create(['name' => 'Standard', 'priority' => 'normal', 'enabled' => true]);

        $this->actingAs($admin, 'staff')
            ->patch("/securecrm/slas/{$policy->id}", [
                'name' => 'Standard',
                'priority' => 'high',
                'first_response_target' => 15,
                'resolution_target' => 240,
                'enabled' => '1',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('audit_logs', [
            'action' => AuditLog::SLA_UPDATE,
            'staff_user_id' => $admin->id,
            'subject_reference' => 'Standard',
        ]);

        $log = AuditLog::where('action', AuditLog::SLA_UPDATE)->first();
        $this->assertSame(['priority' => 'normal', 'enabled' => true], $log->before);
        $this->assertSame(['priority' => 'high', 'enabled' => true], $log->after);
    }

    public function test_audit_list_shows_entries_and_filters_by_action(): void
    {
        $admin = StaffUser::factory()->admin()->create();
        $ticket = Ticket::factory()->forUser()->create();

        AuditLog::create(['staff_user_id' => $admin->id, 'action' => AuditLog::TICKET_ASSIGN, 'subject_id' => $ticket->id, 'subject_reference' => $ticket->ticket_number]);
        AuditLog::create(['staff_user_id' => $admin->id, 'action' => AuditLog::LOGIN, 'subject_reference' => $admin->email]);

        $this->actingAs($admin, 'staff')
            ->get('/securecrm/audit')
            ->assertOk()
            ->assertSee('Ticket reassigned')
            ->assertSee($ticket->ticket_number)
            ->assertSee($admin->email);

        $this->actingAs($admin, 'staff')
            ->get('/securecrm/audit?action='.AuditLog::LOGIN)
            ->assertOk()
            ->assertSee($admin->email)
            ->assertDontSee($ticket->ticket_number);
    }
}
