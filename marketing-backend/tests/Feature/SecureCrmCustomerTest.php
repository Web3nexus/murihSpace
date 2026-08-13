<?php

namespace Tests\Feature;

use App\Models\StaffUser;
use App\Models\Ticket;
use App\Models\TicketCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SecureCrmCustomerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.main_backend.base_url' => 'http://backend.test', 'services.main_backend.token' => 'secret-token']);
    }

    private function fakeBackend(?int $userId = 7): void
    {
        if ($userId === null) {
            Http::fake([
                'backend.test/*' => Http::response(['success' => false, 'data' => null, 'message' => 'User not found.'], 404),
            ]);

            return;
        }

        $user = ['id' => $userId, 'name' => 'Pearl', 'email' => 'pearl@example.com', 'status' => 'active', 'role' => 'creator', 'kyc_status' => 'verified'];

        Http::fake([
            'backend.test/internal/support/users/by-email/*' => Http::response(['success' => true, 'data' => $user], 200),
            'backend.test/internal/support/users/*/summary' => Http::response(['success' => true, 'data' => $user], 200),
            'backend.test/internal/support/users/*/orders' => Http::response(['success' => true, 'data' => [['order_number' => 'ORD-1', 'status' => 'completed', 'total' => '1150.00', 'currency' => 'USD']]], 200),
            'backend.test/internal/support/users/*/subscriptions' => Http::response(['success' => true, 'data' => [['plan_name' => 'Pro', 'active' => true, 'current_period_end' => '2026-12-01T00:00:00.000000Z']]], 200),
            'backend.test/internal/support/users/*/wallet-summary' => Http::response(['success' => true, 'data' => ['wallets' => [['wallet_type' => 'available', 'available' => '500.00', 'currency' => 'USD']], 'creator_wallet' => null]], 200),
            'backend.test/internal/support/users/*/kyc-summary' => Http::response(['success' => true, 'data' => ['verifications' => [['provider' => 'smile', 'status' => 'verified', 'completed_at' => '2026-07-01T00:00:00.000000Z']]]], 200),
            'backend.test/internal/support/users/*/transactions' => Http::response(['success' => true, 'data' => [['type' => 'payment', 'status' => 'completed', 'description' => 'E-book', 'entry_type' => 'debit', 'amount' => '1150.00', 'currency' => 'USD']]], 200),
        ]);
    }

    public function test_customer_index_lists_known_customers_from_tickets(): void
    {
        $agent = StaffUser::factory()->role('support_agent')->create();
        Ticket::factory()->create(['customer_email' => 'pearl@example.com', 'customer_name' => 'Pearl', 'status' => 'open']);

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/customers')
            ->assertOk()
            ->assertSee('pearl@example.com')
            ->assertSee('Pearl');
    }

    public function test_customer_profile_shows_account_and_context_data(): void
    {
        $this->fakeBackend();

        $agent = StaffUser::factory()->role('support_agent')->create();
        $category = TicketCategory::factory()->create();
        Ticket::factory()->create(['customer_email' => 'pearl@example.com', 'customer_name' => 'Pearl', 'status' => 'open', 'category_id' => $category->id]);

        $response = $this->actingAs($agent, 'staff')
            ->get('/securecrm/customers/pearl%40example.com');

        $response->assertOk()
            ->assertSee('Pearl')
            ->assertSee('ORD-1')
            ->assertSee('Pro')
            ->assertSee('Payment');
    }

    public function test_customer_profile_headless_account_shows_local_data_only(): void
    {
        $this->fakeBackend(null);

        $agent = StaffUser::factory()->role('support_agent')->create();
        Ticket::factory()->create(['customer_email' => 'nobody@example.com', 'customer_name' => 'Ghost', 'status' => 'new']);

        $this->actingAs($agent, 'staff')
            ->get('/securecrm/customers/nobody%40example.com')
            ->assertOk()
            ->assertSee('No main-application account was found');
    }

    public function test_staff_with_note_permission_can_add_support_note(): void
    {
        $this->fakeBackend();

        $agent = StaffUser::factory()->role('support_manager')->create();

        $this->actingAs($agent, 'staff')
            ->post('/securecrm/customers/pearl%40example.com/notes', [
                'body' => 'Customer prefers morning calls.',
            ])
            ->assertRedirect();

        $this->assertDatabaseHas('support_notes', [
            'customer_email' => 'pearl@example.com',
            'body' => 'Customer prefers morning calls.',
        ]);
    }

    public function test_staff_without_note_permission_cannot_add_support_note(): void
    {
        $this->fakeBackend();

        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')
            ->post('/securecrm/customers/pearl%40example.com/notes', [
                'body' => 'Should be blocked.',
            ])
            ->assertForbidden();

        $this->assertDatabaseMissing('support_notes', ['body' => 'Should be blocked.']);
    }

    public function test_profile_requests_are_signed_internal_requests(): void
    {
        $this->fakeBackend();

        $agent = StaffUser::factory()->role('support_agent')->create();

        $this->actingAs($agent, 'staff')->get('/securecrm/customers/pearl%40example.com')->assertOk();

        Http::assertSent(function (Request $request) {
            return str_contains($request->url(), '/internal/support/users/by-email/pearl%40example.com')
                && hash_equals('secret-token', (string) ($request->header('X-Internal-Token')[0] ?? ''));
        });
    }
}
