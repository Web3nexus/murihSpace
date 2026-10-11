<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Models\WithdrawalRequest;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * Regression cover for the withdrawal reserve → settle/release lifecycle:
 * funds move withdrawable → reserved at request time, then are consumed
 * (approved) or returned (rejected).
 */
class WithdrawalReserveFlowTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function creator(int $withdrawable): User
    {
        $user = User::factory()->create(['role' => 'creator']);
        $user->forceFill(['kyc_status' => 'verified'])->save();

        (new WalletService())->getOrCreateWallet($user, 'creator')->update([
            'withdrawable' => $withdrawable,
            'pin_hash' => bcrypt('1234'),
        ]);

        return $user->fresh();
    }

    private function wallet(User $user): Wallet
    {
        return Wallet::where('user_id', $user->id)->where('wallet_type', 'creator')->firstOrFail();
    }

    private function requestWithdrawal(User $user, int $amount = 40000)
    {
        return $this->actingAs($user)->postJson('/api/v1/wallet/withdrawals', [
            'wallet_type' => 'creator',
            'amount' => $amount,
            'pin' => '1234',
        ]);
    }

    public function test_request_reserves_funds_from_withdrawable(): void
    {
        $user = $this->creator(100000);

        $this->requestWithdrawal($user)
            ->assertStatus(201)
            ->assertJsonPath('message', 'Withdrawal request submitted for review.');

        $wallet = $this->wallet($user);
        $this->assertSame(60000, (int) $wallet->withdrawable);
        $this->assertSame(40000, (int) $wallet->reserved);
        $this->assertSame(0, (int) $wallet->available);
        $this->assertDatabaseHas('withdrawal_requests', [
            'user_id' => $user->id,
            'status' => 'pending',
            'amount' => 40000,
        ]);
    }

    public function test_request_rejected_when_withdrawable_balance_is_insufficient(): void
    {
        $user = $this->creator(10000);

        $this->requestWithdrawal($user, 40000)
            ->assertStatus(422)
            ->assertJsonPath('errors.code', 'INSUFFICIENT_BALANCE');

        $this->assertSame(10000, (int) $this->wallet($user)->withdrawable);
        $this->assertSame(0, (int) $this->wallet($user)->reserved);
    }

    public function test_rejecting_withdrawal_releases_reserved_funds(): void
    {
        Mail::fake();

        $user = $this->creator(100000);
        $this->requestWithdrawal($user)->assertStatus(201);
        $withdrawal = WithdrawalRequest::where('user_id', $user->id)->firstOrFail();

        $admin = User::factory()->create(['role' => 'admin']);

        $this->actAsSession($admin)
            ->postJson("/api/v1/securegate/withdrawals/{$withdrawal->id}/process", [
                'action' => 'reject',
                'rejection_reason' => 'Payout details could not be verified.',
            ])
            ->assertOk()->assertJsonPath('message', 'Withdrawal rejected.');

        $wallet = $this->wallet($user);
        $this->assertSame(100000, (int) $wallet->withdrawable);
        $this->assertSame(0, (int) $wallet->reserved);
        $this->assertSame('rejected', $withdrawal->fresh()->status);
    }

    public function test_approving_withdrawal_settles_from_reserved(): void
    {
        Mail::fake();

        $user = $this->creator(100000);
        $this->requestWithdrawal($user)->assertStatus(201);
        $withdrawal = WithdrawalRequest::where('user_id', $user->id)->firstOrFail();

        $admin = User::factory()->create(['role' => 'admin']);

        $this->actAsSession($admin)
            ->postJson("/api/v1/securegate/withdrawals/{$withdrawal->id}/process", [
                'action' => 'approve',
            ])
            ->assertOk()->assertJsonPath('message', 'Withdrawal approved and processed.');

        $wallet = $this->wallet($user);
        // Reserved is consumed; withdrawable stays at the post-reserve value.
        $this->assertSame(0, (int) $wallet->reserved);
        $this->assertSame(60000, (int) $wallet->withdrawable);

        $withdrawal->refresh();
        $this->assertSame('completed', $withdrawal->status);
        $this->assertNotNull($withdrawal->ledger_transaction_id);
    }
}
