<?php

namespace Tests\Feature;

use App\Enums\PayoutStatus;
use App\Models\Payout;
use App\Models\PayoutDestination;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Services\Payment\DTO\PayoutRequest;
use App\Services\Payment\DTO\PayoutResponse;
use App\Services\Payment\Providers\PaystackProvider;
use App\Services\Payment\Router\ProviderRouter;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;
use Throwable;

class PayoutSettlementTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private const SECRET = 'sk_test_sample';

    private FakePaystackPayout $provider;

    private User $seller;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();

        $this->provider = new FakePaystackPayout;
        $this->mock(ProviderRouter::class, function ($mock) {
            $mock->shouldReceive('resolve')->andReturn($this->provider);
            $mock->shouldReceive('getProvider')->with('paystack')->andReturn($this->provider);
        });

        $this->seller = User::factory()->create(['role' => 'creator', 'kyc_status' => 'verified']);
        (new WalletService())->getOrCreateWallet($this->seller, 'creator')->update([
            'withdrawable' => 100000,
            'pin_hash' => bcrypt('1234'),
        ]);
        PayoutDestination::create([
            'user_id' => $this->seller->id,
            'destination_type' => 'bank_account',
            'currency' => 'USD',
            'country_code' => 'NG',
            'bank_name' => 'Test Bank',
            'bank_code' => '058',
            'account_number_masked' => '******6789',
            'account_name' => 'Test Seller',
            'details_encrypted' => ['account_number' => '0123456789'],
            'is_default' => true,
            'is_verified' => true,
        ]);

        $this->admin = User::factory()->create([
            'role' => 'admin', 'admin_role' => 'finance_admin', 'admin_permissions' => ['payouts'],
        ]);
    }

    private function wallet(): Wallet
    {
        return Wallet::where('user_id', $this->seller->id)->where('wallet_type', 'creator')->firstOrFail();
    }

    /** A 40000 withdrawal request, submitted by the seller. */
    private function requestWithdrawal(): WithdrawalRequest
    {
        $this->actingAs($this->seller)->postJson('/api/v1/wallet/withdrawals', [
            'wallet_type' => 'creator', 'amount' => 40000, 'pin' => '1234',
        ])->assertStatus(201);

        return WithdrawalRequest::where('user_id', $this->seller->id)->latest('id')->firstOrFail();
    }

    private function approve(WithdrawalRequest $withdrawal)
    {
        return $this->actAsSession($this->admin)
            ->postJson("/api/v1/securegate/withdrawals/{$withdrawal->id}/process", ['action' => 'approve']);
    }

    private function response(PayoutStatus $status, string $transferId = 'TRF_1', ?string $reason = null): PayoutResponse
    {
        return new PayoutResponse(
            provider: 'paystack',
            providerPayoutId: $transferId,
            providerReference: 'PO-TEST',
            status: $status,
            failureReason: $reason,
        );
    }

    /** Sends a Paystack webhook with a valid HMAC-SHA512 signature over the exact body. */
    private function paystackWebhook(array $payload, ?string $signature = null)
    {
        $body = json_encode($payload);
        $signature ??= hash_hmac('sha512', $body, self::SECRET);

        return $this->call('POST', '/api/v1/webhooks/paystack', [], [], [], [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_X_PAYSTACK_SIGNATURE' => $signature,
        ], $body);
    }

    private function transferEvent(string $event, int $eventId, string $reference, string $transferCode = 'TRF_1')
    {
        return [
            'event' => $event,
            'data' => ['id' => $eventId, 'reference' => $reference, 'transfer_code' => $transferCode, 'status' => 'x'],
        ];
    }

    public function test_approval_sends_the_transfer_and_does_not_complete_the_withdrawal(): void
    {
        $withdrawal = $this->requestWithdrawal();
        $this->provider->queue = [$this->response(PayoutStatus::Processing)];

        $this->approve($withdrawal)->assertStatus(202);

        $this->assertSame(1, $this->provider->calls);
        $this->assertSame('processing', $withdrawal->fresh()->status);
        $payout = Payout::where('withdrawal_request_id', $withdrawal->id)->firstOrFail();
        $this->assertSame(PayoutStatus::Processing, $payout->status);
        $this->assertSame('TRF_1', $payout->provider_payout_id);
        // The money stays reserved until the provider confirms.
        $this->assertSame(40000, (int) $this->wallet()->reserved);
        $this->assertSame(60000, (int) $this->wallet()->withdrawable);
    }

    public function test_provider_success_completes_the_payout_once_and_duplicates_are_ignored(): void
    {
        $withdrawal = $this->requestWithdrawal();
        $this->provider->queue = [$this->response(PayoutStatus::Processing)];
        $this->approve($withdrawal);

        $success = $this->transferEvent('transfer.success', 555, Payout::first()->public_reference);
        $this->paystackWebhook($success)->assertOk();
        // The same delivery again is a duplicate event id.
        $this->paystackWebhook($success)->assertOk()->assertJsonPath('data.status', 'acknowledged');
        // A replay under a new event id must not pay again either.
        $this->paystackWebhook($this->transferEvent('transfer.success', 556, Payout::first()->public_reference))->assertOk();

        $this->assertSame('completed', $withdrawal->fresh()->status);
        $this->assertSame(PayoutStatus::Successful, Payout::first()->status);
        $this->assertSame(0, (int) $this->wallet()->reserved);
        $this->assertSame(60000, (int) $this->wallet()->withdrawable);

        // A failure that arrives after the payout was paid cannot give the money back.
        $this->paystackWebhook($this->transferEvent('transfer.failed', 557, Payout::first()->public_reference))->assertOk();
        $this->assertSame('completed', $withdrawal->fresh()->status);
        $this->assertSame(60000, (int) $this->wallet()->withdrawable);
        $this->assertSame(0, (int) $this->wallet()->reserved);
    }

    public function test_provider_failure_returns_the_money_exactly_once(): void
    {
        $withdrawal = $this->requestWithdrawal();
        $this->provider->queue = [$this->response(PayoutStatus::Processing)];
        $this->approve($withdrawal);

        $this->paystackWebhook($this->transferEvent('transfer.failed', 600, Payout::first()->public_reference))->assertOk();
        $this->assertSame('failed', $withdrawal->fresh()->status);
        $this->assertSame(100000, (int) $this->wallet()->withdrawable);
        $this->assertSame(0, (int) $this->wallet()->reserved);

        // A later reversal and a duplicate failure must not release anything again.
        $this->paystackWebhook($this->transferEvent('transfer.reversed', 601, Payout::first()->public_reference))->assertOk();
        $this->paystackWebhook($this->transferEvent('transfer.failed', 602, Payout::first()->public_reference))->assertOk();
        $this->assertSame(100000, (int) $this->wallet()->withdrawable);
        $this->assertSame(0, (int) $this->wallet()->reserved);
    }

    /** A documented transfer payload (tests/Fixtures/paystack), pointed at this test's payout reference. */
    private function transferFixture(string $name): array
    {
        $payload = json_decode(file_get_contents(base_path("tests/Fixtures/paystack/{$name}.json")), true);
        $payload['data']['reference'] = Payout::first()->public_reference;

        return $payload;
    }

    public function test_official_transfer_success_fixture_completes_the_payout_once(): void
    {
        $withdrawal = $this->requestWithdrawal();
        $this->provider->queue = [$this->response(PayoutStatus::Processing)];
        $this->approve($withdrawal);

        $payload = $this->transferFixture('transfer.success');
        $this->paystackWebhook($payload)->assertOk();
        $this->paystackWebhook($payload)->assertOk()->assertJsonPath('data.status', 'acknowledged');

        $this->assertSame('completed', $withdrawal->fresh()->status);
        $this->assertSame(0, (int) $this->wallet()->reserved);
        $this->assertSame(60000, (int) $this->wallet()->withdrawable);
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'payout.completed')->count());
    }

    public function test_official_transfer_failed_fixture_returns_the_money_once(): void
    {
        $withdrawal = $this->requestWithdrawal();
        $this->provider->queue = [$this->response(PayoutStatus::Processing)];
        $this->approve($withdrawal);

        $this->paystackWebhook($this->transferFixture('transfer.failed'))->assertOk();
        $this->paystackWebhook($this->transferFixture('transfer.failed'))->assertOk()->assertJsonPath('data.status', 'acknowledged');

        $this->assertSame('failed', $withdrawal->fresh()->status);
        $this->assertSame(100000, (int) $this->wallet()->withdrawable);
        $this->assertSame(0, (int) $this->wallet()->reserved);
        $this->assertSame(1, \App\Models\AuditLog::where('action', 'payout.failed')->count());
    }

    public function test_official_transfer_reversed_fixture_returns_the_money_once(): void
    {
        $withdrawal = $this->requestWithdrawal();
        $this->provider->queue = [$this->response(PayoutStatus::Processing)];
        $this->approve($withdrawal);

        $this->paystackWebhook($this->transferFixture('transfer.reversed'))->assertOk();
        // A later failure for the same transfer is a second result for money already returned.
        $this->paystackWebhook($this->transferFixture('transfer.failed'))->assertOk();

        $this->assertSame('failed', $withdrawal->fresh()->status);
        $this->assertSame(100000, (int) $this->wallet()->withdrawable);
        $this->assertSame(0, (int) $this->wallet()->reserved);
    }

    public function test_a_bad_webhook_signature_is_rejected_and_changes_nothing(): void
    {
        $withdrawal = $this->requestWithdrawal();
        $this->provider->queue = [$this->response(PayoutStatus::Processing)];
        $this->approve($withdrawal);

        $this->paystackWebhook(
            $this->transferEvent('transfer.success', 700, Payout::first()->public_reference),
            signature: str_repeat('0', 128),
        )->assertStatus(401);

        $this->assertSame('processing', $withdrawal->fresh()->status);
        $this->assertSame(PayoutStatus::Processing, Payout::first()->status);
        $this->assertSame(40000, (int) $this->wallet()->reserved);
    }

    public function test_admin_cannot_complete_a_payout_the_provider_has_not_confirmed(): void
    {
        $withdrawal = $this->requestWithdrawal();
        $this->provider->queue = [$this->response(PayoutStatus::Processing)];
        $this->approve($withdrawal);

        // The manual mark-paid endpoints no longer exist.
        $this->actAsSession($this->admin)
            ->putJson('/api/v1/securegate/payouts/1/mark-paid')
            ->assertStatus(404);
        $this->actAsSession($this->admin)
            ->postJson('/api/v1/securegate/gift-payouts/1/mark-paid')
            ->assertStatus(404);

        // Retry is refused for a transfer the provider accepted (it has a provider id).
        $this->actAsSession($this->admin)
            ->postJson("/api/v1/securegate/withdrawals/{$withdrawal->id}/retry-transfer")
            ->assertStatus(409)
            ->assertJsonPath('errors.code', 'RETRY_NOT_ALLOWED');

        // Approving again is refused, because the withdrawal is no longer pending.
        $this->approve($withdrawal)->assertStatus(409);

        $this->assertSame('processing', $withdrawal->fresh()->status);
        $this->assertSame(40000, (int) $this->wallet()->reserved);
        $this->assertSame(60000, (int) $this->wallet()->withdrawable);
        $this->assertSame(1, $this->provider->calls);
    }

    public function test_a_rejected_transfer_keeps_funds_reserved_until_a_retry_is_confirmed(): void
    {
        $withdrawal = $this->requestWithdrawal();
        $this->provider->queue = [
            $this->response(PayoutStatus::Failed, '', 'Recipient account invalid'),
            $this->response(PayoutStatus::Processing),
        ];

        $this->approve($withdrawal)->assertStatus(202);
        $this->assertSame('dispatch_failed', $withdrawal->fresh()->status);
        $this->assertSame(40000, (int) $this->wallet()->reserved);
        $this->assertSame(PayoutStatus::Failed, Payout::first()->status);

        $this->actAsSession($this->admin)
            ->postJson("/api/v1/securegate/withdrawals/{$withdrawal->id}/retry-transfer")
            ->assertStatus(202);

        $this->assertSame(2, $this->provider->calls);
        $this->assertSame('processing', $withdrawal->fresh()->status);
        // The retry reuses the same payout row, so the provider reference is the same.
        $this->assertSame(1, Payout::count());
        $this->assertSame(40000, (int) $this->wallet()->reserved);

        $this->paystackWebhook($this->transferEvent('transfer.success', 800, Payout::first()->public_reference))->assertOk();
        $this->assertSame('completed', $withdrawal->fresh()->status);
        $this->assertSame(0, (int) $this->wallet()->reserved);
    }

    public function test_an_exception_during_dispatch_leaves_the_withdrawal_for_the_provider_to_settle(): void
    {
        $withdrawal = $this->requestWithdrawal();
        $this->provider->throws = new \RuntimeException('Connection timed out');

        $this->approve($withdrawal)->assertStatus(202);

        $this->assertSame('processing', $withdrawal->fresh()->status);
        $this->assertSame('Connection timed out', Payout::first()->dispatch_error);
        $this->assertSame(40000, (int) $this->wallet()->reserved);

        // Its retry is allowed, because no provider id was ever recorded.
        $this->provider->throws = null;
        $this->provider->queue = [$this->response(PayoutStatus::Processing)];
        $this->actAsSession($this->admin)
            ->postJson("/api/v1/securegate/withdrawals/{$withdrawal->id}/retry-transfer")
            ->assertStatus(202);
        $this->assertSame('processing', $withdrawal->fresh()->status);
        $this->assertNull(Payout::first()->dispatch_error);
    }
}

/** Paystack provider whose transfer call is scripted by the test. */
class FakePaystackPayout extends PaystackProvider
{
    /** @var array<int, PayoutResponse> */
    public array $queue = [];

    public int $calls = 0;

    public ?Throwable $throws = null;

    public function initiatePayout(PayoutRequest $request): PayoutResponse
    {
        $this->calls++;
        if ($this->throws) {
            throw $this->throws;
        }

        return array_shift($this->queue);
    }
}
