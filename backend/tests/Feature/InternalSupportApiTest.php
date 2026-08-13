<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\DigitalProduct;
use App\Models\KycVerification;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\NotificationPreference;
use App\Models\Order;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Models\Wallet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class InternalSupportApiTest extends TestCase
{
    use RefreshDatabase;

    private const TOKEN = 'test-internal-token';

    protected function setUp(): void
    {
        parent::setUp();
        Config::set('internal.token', self::TOKEN);
        Config::set('internal.allowed_ips', []);
        Config::set('internal.replay_window', 300);
        Config::set('internal.rate_limit', ['attempts' => 300, 'decay' => 60]);
        RateLimiter::clear('internal-api:'.sha1(self::TOKEN));
    }

    private function headers(): array
    {
        return [
            'X-Internal-Token' => self::TOKEN,
            'X-Timestamp' => (string) now()->getTimestamp(),
            'X-Nonce' => (string) now()->format('Uu').bin2hex(random_bytes(8)),
            'Accept' => 'application/json',
        ];
    }

    public function test_requires_valid_token(): void
    {
        $user = User::factory()->create();

        $this->getJson("/internal/support/users/{$user->id}/summary", [
            'X-Internal-Token' => 'wrong-token',
            'X-Timestamp' => (string) now()->getTimestamp(),
            'X-Nonce' => bin2hex(random_bytes(16)),
        ])->assertStatus(403);
    }

    public function test_rejects_stale_timestamp(): void
    {
        $user = User::factory()->create();
        $headers = $this->headers();
        $headers['X-Timestamp'] = (string) (now()->getTimestamp() - 600);

        $this->getJson("/internal/support/users/{$user->id}/summary", $headers)
            ->assertStatus(400);
    }

    public function test_rejects_reused_nonce(): void
    {
        $user = User::factory()->create();
        $headers = $this->headers();

        $this->getJson("/internal/support/users/{$user->id}/summary", $headers)->assertOk();
        $this->getJson("/internal/support/users/{$user->id}/summary", $headers)
            ->assertStatus(400);
    }

    public function test_user_summary_shape(): void
    {
        $user = User::factory()->create([
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'role' => 'creator',
            'kyc_status' => 'verified',
        ]);

        $this->getJson("/internal/support/users/{$user->id}/summary", $this->headers())
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.name', 'Jane Doe')
            ->assertJsonPath('data.email', 'jane@example.com')
            ->assertJsonPath('data.role', 'creator')
            ->assertJsonPath('data.kyc_status', 'verified');
    }

    public function test_user_orders_lists_buyer_orders(): void
    {
        $buyer = User::factory()->create();
        $creator = User::factory()->create();
        $product = DigitalProduct::create([
            'creator_id' => $creator->id,
            'title' => 'E-book',
            'slug' => 'ebook-'.uniqid(),
            'price' => 1000,
        ]);
        $order = Order::create([
            'order_number' => 'ORD-1',
            'buyer_id' => $buyer->id,
            'creator_id' => $creator->id,
            'product_id' => $product->id,
            'idempotency_key' => 'ord-1-key',
            'subtotal' => 1000,
            'status' => 'completed',
            'currency' => 'USD',
            'subtotal' => 1000,
            'platform_fee' => 100,
            'tax' => 50,
            'total' => 1150,
            'paid_at' => now(),
        ]);

        $response = $this->getJson("/internal/support/users/{$buyer->id}/orders", $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.0.order_number', 'ORD-1')
            ->assertJsonPath('data.0.status', 'completed')
            ->assertJsonPath('data.0.total', '1150.00');
    }

    public function test_user_subscriptions_includes_plan(): void
    {
        $subscriber = User::factory()->create();
        $creator = User::factory()->create();
        $plan = SubscriptionPlan::create([
            'creator_id' => $creator->id,
            'name' => 'Pro Plan',
            'price' => 999,
            'currency' => 'USD',
            'billing_cycle' => 'monthly',
        ]);
        Subscription::create([
            'plan_id' => $plan->id,
            'subscriber_id' => $subscriber->id,
            'creator_id' => $creator->id,
            'status' => 'active',
            'current_period_start' => now()->subDay(),
            'current_period_end' => now()->addDays(29),
        ]);

        $response = $this->getJson("/internal/support/users/{$subscriber->id}/subscriptions", $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.0.plan_name', 'Pro Plan')
            ->assertJsonPath('data.0.status', 'active')
            ->assertJsonPath('data.0.active', true);
    }

    public function test_user_wallet_summary_includes_balances(): void
    {
        $user = User::factory()->create();
        Wallet::create([
            'user_id' => $user->id,
            'wallet_type' => 'creator',
            'available' => 5000,
            'withdrawable' => 4000,
            'currency' => 'USD',
            'status' => 'active',
        ]);

        $response = $this->getJson("/internal/support/users/{$user->id}/wallet-summary", $this->headers());

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.wallets.0.wallet_type', 'creator')
            ->assertJsonPath('data.wallets.0.available', 5000);
    }

    public function test_user_kyc_summary_includes_verifications(): void
    {
        $user = User::factory()->create(['kyc_status' => 'rejected']);
        KycVerification::create([
            'user_id' => $user->id,
            'provider' => 'sumsub',
            'status' => 'rejected',
            'rejection_reason' => 'Docs unreadable',
        ]);

        $response = $this->getJson("/internal/support/users/{$user->id}/kyc-summary", $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.kyc_status', 'rejected')
            ->assertJsonPath('data.latest.status', 'rejected')
            ->assertJsonPath('data.latest.rejection_reason', 'Docs unreadable');
    }

    public function test_transaction_summary_includes_entries(): void
    {
        $user = User::factory()->create();
        $txn = LedgerTransaction::create([
            'type' => 'payment',
            'status' => 'completed',
            'description' => 'Product purchase',
        ]);
        LedgerEntry::create([
            'ledger_transaction_id' => $txn->id,
            'user_id' => $user->id,
            'account_type' => 'user',
            'wallet_type' => 'available',
            'balance_category' => 'available',
            'entry_type' => 'debit',
            'amount' => 1150,
            'currency' => 'USD',
            'balance_before' => 5000,
            'balance_after' => 3850,
        ]);

        $response = $this->getJson("/internal/support/transactions/{$txn->id}/summary", $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.type', 'payment')
            ->assertJsonPath('data.entries.0.entry_type', 'debit')
            ->assertJsonPath('data.entries.0.amount', 1150);
    }

    public function test_order_summary_returns_buyer_and_product(): void
    {
        $buyer = User::factory()->create(['name' => 'Bob', 'email' => 'bob@example.com']);
        $creator = User::factory()->create();
        $product = DigitalProduct::create([
            'creator_id' => $creator->id,
            'title' => 'E-book',
            'slug' => 'ebook-'.uniqid(),
            'price' => 1000,
        ]);
        $order = Order::create([
            'order_number' => 'ORD-42',
            'buyer_id' => $buyer->id,
            'creator_id' => $creator->id,
            'product_id' => $product->id,
            'idempotency_key' => 'ord-42-key',
            'subtotal' => 2990,
            'total' => 2990,
            'status' => 'completed',
            'currency' => 'USD',
        ]);

        $response = $this->getJson("/internal/support/orders/{$order->id}", $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.order_number', 'ORD-42')
            ->assertJsonPath('data.buyer.name', 'Bob')
            ->assertJsonPath('data.buyer.email', 'bob@example.com');
    }

    public function test_unknown_user_returns_404(): void
    {
        $this->getJson('/internal/support/users/99999/summary', $this->headers())
            ->assertStatus(404);
    }

    public function test_lookup_user_by_email_returns_summary(): void
    {
        User::factory()->create(['email' => 'finder@example.com', 'name' => 'Pearl']);

        $response = $this->getJson(
            '/internal/support/users/by-email/finder@example.com',
            $this->headers()
        );

        $response->assertOk()
            ->assertJsonPath('data.email', 'finder@example.com')
            ->assertJsonPath('data.name', 'Pearl');
    }

    public function test_lookup_user_by_email_returns_404_for_unknown(): void
    {
        $this->getJson('/internal/support/users/by-email/nobody@example.com', $this->headers())
            ->assertStatus(404)
            ->assertJsonPath('data', null);
    }

    public function test_user_transactions_lists_ledger_entries(): void
    {
        $user = User::factory()->create();
        $txn = LedgerTransaction::create([
            'type' => 'payout',
            'status' => 'completed',
            'description' => 'Withdrawal',
        ]);
        LedgerEntry::create([
            'ledger_transaction_id' => $txn->id,
            'user_id' => $user->id,
            'account_type' => 'user',
            'wallet_type' => 'available',
            'balance_category' => 'available',
            'entry_type' => 'debit',
            'amount' => 2500,
            'currency' => 'USD',
            'balance_before' => 3000,
            'balance_after' => 500,
        ]);

        $response = $this->getJson("/internal/support/users/{$user->id}/transactions", $this->headers());

        $response->assertOk()
            ->assertJsonPath('data.0.transaction_id', $txn->id)
            ->assertJsonPath('data.0.type', 'payout')
            ->assertJsonPath('data.0.entry_type', 'debit')
            ->assertJsonPath('data.0.amount', 2500);
    }

    public function test_audit_log_written_for_internal_access(): void
    {
        $user = User::factory()->create();

        $this->getJson("/internal/support/users/{$user->id}/summary", $this->headers())->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'internal.user.summary',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
        ]);
        $this->assertSame(1, AuditLog::where('action', 'internal.user.summary')->count());
    }

    public function test_notify_customer_creates_in_app_notification(): void
    {
        $user = User::factory()->create(['email' => 'pearl@example.com', 'name' => 'Pearl']);

        $response = $this->postJson('/internal/support/notifications', [
            'email' => 'pearl@example.com',
            'type' => 'ticket_created',
            'title' => 'New ticket MS-2026-000012',
            'message' => 'Your request "Double charge" has been received.',
            'action_url' => '/app/messages/support',
            'ticket_number' => 'MS-2026-000012',
        ], $this->headers());

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('delivered', true)
            ->assertJsonPath('user_id', $user->id);

        $this->assertSame(1, DatabaseNotification::count());
        $notification = DatabaseNotification::first();
        $this->assertSame('ticket_created', $notification->type);
        $this->assertSame($user->id, $notification->notifiable_id);
        $this->assertSame('ticket_created', $notification->data['type']);
        $this->assertSame('New ticket MS-2026-000012', $notification->data['title']);
        $this->assertSame('/app/messages/support', $notification->data['action_url']);
        $this->assertNull($notification->read_at);
    }

    public function test_notify_customer_audits_creation(): void
    {
        $user = User::factory()->create(['email' => 'pearl@example.com']);

        $this->postJson('/internal/support/notifications', [
            'email' => 'pearl@example.com',
            'type' => 'ticket_reply',
            'title' => 'New reply',
            'message' => 'Thanks for writing in.',
        ], $this->headers())->assertOk();

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'internal.notification.create',
            'resource_type' => 'user',
            'resource_id' => (string) $user->id,
        ]);
    }

    public function test_notify_customer_unknown_email_returns_delivered_false(): void
    {
        $response = $this->postJson('/internal/support/notifications', [
            'email' => 'nobody@example.com',
            'type' => 'ticket_created',
            'title' => 'New ticket',
            'message' => 'Hello',
        ], $this->headers());

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('delivered', false)
            ->assertJsonPath('reason', 'user_not_found');

        $this->assertSame(0, DatabaseNotification::count());
    }

    public function test_notify_customer_validates_payload(): void
    {
        $this->postJson('/internal/support/notifications', [
            'email' => 'not-an-email',
            'type' => 'not-a-real-type',
            'title' => '',
        ], $this->headers())
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'type', 'title', 'message']);

        $this->assertSame(0, DatabaseNotification::count());
    }

    public function test_notify_customer_respects_in_app_preference(): void
    {
        $user = User::factory()->create(['email' => 'pearl@example.com']);
        NotificationPreference::create([
            'user_id' => $user->id,
            'type' => 'ticket_created',
            'channel' => 'in_app',
            'enabled' => false,
        ]);

        $this->postJson('/internal/support/notifications', [
            'email' => 'pearl@example.com',
            'type' => 'ticket_created',
            'title' => 'New ticket',
            'message' => 'Hello',
        ], $this->headers())->assertOk()
            ->assertJsonPath('delivered', true);

        $this->assertSame(1, DatabaseNotification::count());
    }
}
