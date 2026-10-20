<?php

namespace Tests\Feature;

use App\Enums\PaymentStatus;
use App\Enums\PayoutStatus;
use App\Enums\RefundStatus;
use App\Models\IdempotencyKey;
use App\Models\LedgerTransaction;
use App\Models\Payment;
use App\Models\PayoutDestination;
use App\Models\Refund;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Payment\DTO\PayoutResponse;
use App\Services\Payment\DTO\RefundResponse;
use App\Services\Payment\PayoutService;
use App\Services\Payment\Providers\PaystackProvider;
use App\Services\Payment\RefundService;
use App\Services\Payment\Router\ProviderRouter;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentLedgerBalanceTest extends TestCase
{
    use RefreshDatabase;

    private function wallet(User $user, string $type = 'system'): Wallet
    {
        return (new WalletService())->getOrCreateWallet($user, $type);
    }

    public function test_an_admin_refund_that_succeeds_at_the_provider_is_committed_and_moves_no_wallet_balance(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $this->wallet($buyer)->update(['available' => 5000]);

        $payment = Payment::create([
            'provider' => 'paystack', 'user_id' => $buyer->id, 'transaction_type' => 'coin_purchase',
            'payment_method' => 'card', 'amount' => 5000, 'currency' => 'USD', 'fees' => 0,
            'net_amount' => 5000, 'status' => PaymentStatus::Successful, 'idempotency_key' => 'p-'.uniqid(),
            'provider_transaction_id' => 'pi_refund_'.uniqid(), 'metadata' => [],
        ]);

        $provider = new FakeRefundPaystack;
        $this->mock(ProviderRouter::class, function ($mock) use ($provider) {
            $mock->shouldReceive('getProvider')->with('paystack')->andReturn($provider);
        });

        $result = app(RefundService::class)->issueRefund([
            'payment_id' => $payment->id,
            'amount' => 2000,
            'reason' => 'Admin refund',
            'idempotency_key' => 'ADMIN_REFUND_'.uniqid(),
        ]);

        $this->assertTrue($result['success']);
        $this->assertSame(1, $provider->calls);

        // The refund row and the payment status are committed.
        $refund = Refund::findOrFail($result['refund_id']);
        $this->assertSame(RefundStatus::Successful, $refund->status);
        $this->assertSame(2000, (int) $refund->amount);
        $this->assertSame(PaymentStatus::PartiallyRefunded, $payment->fresh()->status);
        $this->assertNotNull(IdempotencyKey::where('key', $refund->idempotency_key)->where('scope', 'refund_create')->first());

        // A card refund moves no wallet balance and writes no ledger transaction.
        $this->assertSame(5000, (int) $this->wallet($buyer)->fresh()->available);
        $this->assertSame(0, LedgerTransaction::count());
    }

    public function test_an_immediate_payout_success_debits_the_seller_once_and_a_retry_does_not_debit_again(): void
    {
        $seller = User::factory()->create(['role' => 'creator', 'kyc_status' => 'verified']);
        $this->wallet($seller, 'creator')->update(['withdrawable' => 10000]);
        $destination = PayoutDestination::create([
            'user_id' => $seller->id,
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

        $provider = new FakePayoutPaystack;
        $this->mock(ProviderRouter::class, function ($mock) use ($provider) {
            $mock->shouldReceive('resolve')->andReturn($provider);
        });

        $data = [
            'user_id' => $seller->id,
            'amount' => 4000,
            'currency' => 'USD',
            'payout_destination_id' => $destination->id,
            'idempotency_key' => 'PAYOUT_TEST_'.uniqid(),
        ];

        $first = app(PayoutService::class)->createPayout($data);
        $this->assertSame(PayoutStatus::Successful->value, $first['status']);
        $this->assertSame(6000, (int) $this->wallet($seller, 'creator')->fresh()->withdrawable);

        $second = app(PayoutService::class)->createPayout($data);

        $this->assertSame($first['payout_id'], $second['payout_id']);
        $this->assertSame(1, $provider->calls);
        $this->assertSame(6000, (int) $this->wallet($seller, 'creator')->fresh()->withdrawable);
        $this->assertSame(1, LedgerTransaction::where('idempotency_key', 'like', 'PAYOUT_%_DEBIT')->count());
    }
}

class FakeRefundPaystack extends PaystackProvider
{
    public int $calls = 0;

    public function processRefund(\App\Services\Payment\DTO\RefundRequest $request): RefundResponse
    {
        $this->calls++;

        return new RefundResponse('paystack', 're_'.uniqid(), RefundStatus::Successful);
    }
}

class FakePayoutPaystack extends PaystackProvider
{
    public int $calls = 0;

    public function initiatePayout(\App\Services\Payment\DTO\PayoutRequest $request): PayoutResponse
    {
        $this->calls++;

        return new PayoutResponse('paystack', 'po_'.uniqid(), 'ref_'.uniqid(), PayoutStatus::Successful);
    }
}
