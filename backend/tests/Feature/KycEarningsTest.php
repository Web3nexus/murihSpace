<?php

namespace Tests\Feature;

use App\Models\Escrow;
use App\Models\KycPendingEarning;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Services\Escrow\EscrowTimingService;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Payment\PayoutService;
use App\Services\Wallet\SellerEarningsService;
use App\Services\Wallet\WalletService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class KycEarningsTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function creator(bool $verified): User
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => $verified ? 'verified' : 'not_started']);
        (new WalletService())->getOrCreateWallet($user, 'creator');

        return $user->fresh();
    }

    private function wallet(User $user): Wallet
    {
        return Wallet::where('user_id', $user->id)->where('wallet_type', 'creator')->firstOrFail();
    }

    public function test_unverified_seller_earnings_are_held_in_pending_and_they_are_told_to_verify(): void
    {
        $seller = $this->creator(false);

        app(SellerEarningsService::class)->credit(
            seller: $seller, amount: 30000, currency: 'USD', type: 'creator_gift_receipt',
            description: 'Gift', idempotencyKey: 'TEST_KYC_1',
        );

        $wallet = $this->wallet($seller)->fresh();
        $this->assertSame(30000, (int) $wallet->pending);
        $this->assertSame(0, (int) $wallet->withdrawable);
        $this->assertSame(1, KycPendingEarning::where('user_id', $seller->id)->whereNull('swept_at')->count());
        $this->assertSame(1, $seller->notifications()->where('data->kind', 'kyc_required_for_earnings')->count());
    }

    public function test_verifying_identity_releases_held_earnings_to_withdrawable(): void
    {
        $seller = $this->creator(false);
        app(SellerEarningsService::class)->credit(
            seller: $seller, amount: 30000, currency: 'USD', type: 'creator_gift_receipt',
            description: 'Gift', idempotencyKey: 'TEST_KYC_2',
        );

        $seller->forceFill(['kyc_status' => 'verified'])->save();

        $wallet = $this->wallet($seller)->fresh();
        $this->assertSame(0, (int) $wallet->pending);
        $this->assertSame(30000, (int) $wallet->withdrawable);
        $this->assertSame(0, KycPendingEarning::where('user_id', $seller->id)->whereNull('swept_at')->count());
    }

    public function test_held_earnings_stay_held_while_an_order_is_on_hold(): void
    {
        $seller = $this->creator(false);
        app(SellerEarningsService::class)->credit(
            seller: $seller, amount: 30000, currency: 'USD', type: 'creator_gift_receipt',
            description: 'Gift', idempotencyKey: 'TEST_KYC_3',
        );
        $buyer = User::factory()->create(['role' => 'member']);
        Escrow::create([
            'buyer_id' => $buyer->id, 'seller_id' => $seller->id, 'amount' => 5000,
            'currency' => 'USD', 'status' => 'on_hold', 'hold_reason' => 'manual: review',
        ]);

        $seller->forceFill(['kyc_status' => 'verified'])->save();

        $this->assertSame(30000, (int) $this->wallet($seller)->fresh()->pending);
        $this->assertSame(0, (int) $this->wallet($seller)->fresh()->withdrawable);
    }

    public function test_a_released_escrow_for_an_unverified_seller_goes_to_pending(): void
    {
        $seller = $this->creator(false);
        $buyer = User::factory()->create(['role' => 'member']);
        app(WalletService::class)->getOrCreateWallet($buyer, 'system')->update(['available' => 40000]);
        $escrow = Escrow::create([
            'buyer_id' => $buyer->id, 'seller_id' => $seller->id, 'amount' => 40000,
            'currency' => 'USD', 'status' => 'held',
        ]);
        app(EscrowTimingService::class)->recordDelivery($escrow, 'digital', Carbon::now()->subDays(3));

        app(\App\Services\Escrow\EscrowService::class)->release($escrow->fresh(), null, 'test');

        $this->assertSame(40000, (int) $this->wallet($seller)->fresh()->pending);
        $this->assertSame(0, (int) $this->wallet($seller)->fresh()->withdrawable);
    }

    public function test_a_payout_is_refused_for_a_user_without_kyc(): void
    {
        $seller = $this->creator(false);

        try {
            app(PayoutService::class)->createPayout(['user_id' => $seller->id, 'amount' => 1000, 'currency' => 'USD', 'payout_destination_id' => 1]);
            $this->fail('A payout without KYC must be refused.');
        } catch (PaymentException $e) {
            $this->assertSame('KYC_REQUIRED', $e->errorCode);
        }
    }

    public function test_admin_cannot_approve_a_withdrawal_for_a_user_without_kyc(): void
    {
        $seller = $this->creator(false);
        $this->wallet($seller)->update(['withdrawable' => 20000]);
        $withdrawal = WithdrawalRequest::create([
            'user_id' => $seller->id, 'amount' => 10000, 'currency' => 'USD',
            'wallet_type' => 'creator', 'status' => 'pending',
        ]);
        $admin = User::factory()->create([
            'role' => 'admin', 'admin_role' => 'finance_admin', 'admin_permissions' => ['payouts'],
        ]);

        $this->actingAsSession($admin)
            ->postJson("/api/v1/securegate/withdrawals/{$withdrawal->id}/process", ['action' => 'approve'])
            ->assertStatus(422)
            ->assertJsonPath('errors.code', 'KYC_REQUIRED');

        $this->assertSame('pending', $withdrawal->fresh()->status);
    }

    public function test_a_release_blocked_by_another_dispute_is_recorded_and_released_when_the_dispute_clears(): void
    {
        $seller = $this->creator(true);
        $buyer = User::factory()->create(['role' => 'member']);
        app(WalletService::class)->getOrCreateWallet($buyer, 'system')->update(['available' => 80000]);

        // One order is in dispute, which blocks releases for this seller.
        $disputed = Escrow::create([
            'buyer_id' => $buyer->id, 'seller_id' => $seller->id, 'amount' => 5000,
            'currency' => 'USD', 'status' => 'disputed',
        ]);

        $released = Escrow::create([
            'buyer_id' => $buyer->id, 'seller_id' => $seller->id, 'amount' => 30000,
            'currency' => 'USD', 'status' => 'held',
        ]);
        app(EscrowTimingService::class)->recordDelivery($released, 'digital', Carbon::now()->subDays(3));
        app(\App\Services\Escrow\EscrowService::class)->release($released->fresh(), null, 'test');

        $wallet = Wallet::where('user_id', $seller->id)->where('wallet_type', 'creator')->first()->fresh();
        $this->assertSame(30000, (int) $wallet->pending, 'Blocked by the dispute, the release waits in pending.');
        $this->assertSame(0, (int) $wallet->withdrawable);
        $this->assertSame(1, KycPendingEarning::where('user_id', $seller->id)->where('reason', 'review')->whereNull('swept_at')->count());

        // The dispute is resolved: the held release becomes withdrawable.
        $disputed->update(['status' => 'released']);

        $wallet = $wallet->fresh();
        $this->assertSame(0, (int) $wallet->pending);
        $this->assertSame(30000, (int) $wallet->withdrawable);
    }
}
