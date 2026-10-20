<?php

namespace Tests\Feature;

use App\Models\Conversation;
use App\Models\Escrow;
use App\Models\Message;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Escrow\EscrowTimingService;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class EscrowMoneyRulesTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private Carbon $start;

    protected function setUp(): void
    {
        parent::setUp();
        $this->start = Carbon::parse('2026-10-19 09:00:00');
        Carbon::setTestNow($this->start);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function creator(bool $verified = true, int $withdrawable = 0): User
    {
        $user = User::factory()->create(['role' => 'creator']);
        if ($verified) {
            $user->forceFill(['kyc_status' => 'verified'])->save();
        }
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

    private function escrow(User $buyer, User $seller, int $amount = 40000): Escrow
    {
        return Escrow::create([
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount' => $amount,
            'currency' => 'USD',
            'status' => 'held',
        ]);
    }

    private function joinConversation(Conversation $conversation, array $users): void
    {
        foreach ($users as $user) {
            \App\Models\ConversationParticipant::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
            ]);
        }
    }

    public function test_earnings_repay_the_debt_before_the_seller_receives_anything(): void
    {
        $seller = $this->creator(true, 0);
        $this->wallet($seller)->update(['debt' => 5000]);

        app(LedgerService::class)->creditEarnings(
            user: $seller, amount: 40000, currency: 'USD', walletType: 'creator',
            balanceCategory: 'withdrawable', type: 'escrow_release', description: 'test',
            idempotencyKey: 'TEST_EARN_1',
        );

        $wallet = $this->wallet($seller)->fresh();
        $this->assertSame(0, (int) $wallet->debt);
        $this->assertSame(35000, (int) $wallet->withdrawable);
    }

    public function test_a_clawback_takes_what_is_there_and_records_the_rest_as_debt(): void
    {
        $seller = $this->creator(true, 10000);

        $result = app(LedgerService::class)->debitAllowingDebt(
            user: $seller, amount: 30000, currency: 'USD', walletType: 'creator',
            balanceCategory: 'withdrawable', type: 'clawback', description: 'Chargeback',
            idempotencyKey: 'TEST_CLAW_1',
        );

        $this->assertSame(['debited' => 10000, 'debt_added' => 20000], $result);
        $wallet = $this->wallet($seller)->fresh();
        $this->assertSame(0, (int) $wallet->withdrawable);
        $this->assertSame(20000, (int) $wallet->debt);
    }

    public function test_released_funds_land_in_withdrawable_for_a_verified_seller(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = $this->creator(true);
        app(WalletService::class)->getOrCreateWallet($buyer, 'system')->update(['available' => 40000]);
        $escrow = $this->escrow($buyer, $seller);
        app(EscrowTimingService::class)->recordDelivery($escrow, 'digital');

        Carbon::setTestNow($this->start->copy()->addHours(49));
        app(EscrowTimingService::class)->processDue();

        $this->assertSame('released', $escrow->fresh()->status);
        $this->assertSame(40000, (int) $this->wallet($seller)->fresh()->withdrawable);
    }

    public function test_released_funds_wait_in_pending_for_an_unverified_seller(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = $this->creator(false);
        app(WalletService::class)->getOrCreateWallet($buyer, 'system')->update(['available' => 40000]);
        $escrow = $this->escrow($buyer, $seller);
        app(EscrowTimingService::class)->recordDelivery($escrow, 'digital');

        Carbon::setTestNow($this->start->copy()->addHours(49));
        app(EscrowTimingService::class)->processDue();

        $wallet = $this->wallet($seller)->fresh();
        $this->assertSame(0, (int) $wallet->withdrawable);
        $this->assertSame(40000, (int) $wallet->pending);
    }

    public function test_withdrawal_is_locked_while_the_wallet_owes_money(): void
    {
        $seller = $this->creator(true, 40000);
        $this->wallet($seller)->update(['debt' => 1000]);

        $this->actingAsSession($seller)
            ->postJson('/api/v1/wallet/withdrawals', ['wallet_type' => 'creator', 'amount' => 10000, 'pin' => '1234'])
            ->assertStatus(403)
            ->assertJsonPath('errors.code', 'NEGATIVE_BALANCE');
    }

    public function test_withdrawal_is_locked_while_a_sold_order_is_on_hold(): void
    {
        $seller = $this->creator(true, 40000);
        $buyer = User::factory()->create(['role' => 'member']);
        $this->escrow($buyer, $seller)->update(['status' => 'on_hold', 'hold_reason' => 'manual: review']);

        $this->actingAsSession($seller)
            ->postJson('/api/v1/wallet/withdrawals', ['wallet_type' => 'creator', 'amount' => 10000, 'pin' => '1234'])
            ->assertStatus(403)
            ->assertJsonPath('errors.code', 'FUNDS_ON_HOLD');
    }

    public function test_two_way_contact_stops_a_no_delivery_hold(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = $this->creator(true);
        $escrow = $this->escrow($buyer, $seller);

        $conversation = Conversation::create(['type' => 'direct']);
        $this->joinConversation($conversation, [$buyer, $seller]);
        Carbon::setTestNow($this->start->copy()->addDays(1));
        Message::create(['conversation_id' => $conversation->id, 'user_id' => $buyer->id, 'content' => 'Hi, when will it ship?', 'type' => 'text', 'status' => 'sent']);
        Message::create(['conversation_id' => $conversation->id, 'user_id' => $seller->id, 'content' => 'Shipping tomorrow.', 'type' => 'text', 'status' => 'sent']);

        Carbon::setTestNow($this->start->copy()->addDays(15));
        app(EscrowTimingService::class)->processDue();

        $escrow->refresh();
        $this->assertSame('held', $escrow->status, 'Two-way contact must not freeze the escrow.');
        $this->assertTrue($escrow->release_at->gt(now()), 'The check is pushed out to run again later.');
    }

    public function test_one_sided_contact_still_holds_the_escrow(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = $this->creator(true);
        $escrow = $this->escrow($buyer, $seller);

        $conversation = Conversation::create(['type' => 'direct']);
        $this->joinConversation($conversation, [$buyer, $seller]);
        Message::create(['conversation_id' => $conversation->id, 'user_id' => $buyer->id, 'content' => 'Hello?', 'type' => 'text', 'status' => 'sent']);

        Carbon::setTestNow($this->start->copy()->addDays(15));
        app(EscrowTimingService::class)->processDue();

        $this->assertSame('on_hold', $escrow->fresh()->status);
    }

    public function test_a_party_can_continue_an_automatic_hold_but_not_a_staff_hold(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = $this->creator(true);
        $auto = $this->escrow($buyer, $seller);
        $auto->update(['status' => 'on_hold', 'hold_reason' => 'no_delivery']);

        $this->actingAsSession($seller)
            ->postJson("/api/v1/wallet/escrow/{$auto->id}/resume")
            ->assertOk();
        $this->assertSame('held', $auto->fresh()->status);

        $manual = $this->escrow($buyer, $seller);
        $manual->update(['status' => 'on_hold', 'hold_reason' => 'manual: review']);
        $this->actingAsSession($seller)
            ->postJson("/api/v1/wallet/escrow/{$manual->id}/resume")
            ->assertStatus(422);
        $this->assertSame('on_hold', $manual->fresh()->status);
    }
}
