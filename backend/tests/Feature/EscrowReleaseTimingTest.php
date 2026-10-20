<?php

namespace Tests\Feature;

use App\Models\Dispute;
use App\Models\Escrow;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Escrow\EscrowService;
use App\Services\Escrow\EscrowTimingService;
use App\Services\Wallet\WalletService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class EscrowReleaseTimingTest extends TestCase
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

    private function parties(): array
    {
        $buyer = User::factory()->create(['role' => 'member', 'mobile_number' => '+2348030000001']);
        $seller = User::factory()->create(['role' => 'creator', 'mobile_number' => '+2348030000002']);
        $seller->forceFill(['kyc_status' => 'verified'])->save();

        return [$buyer, $seller];
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

    private function service(): EscrowTimingService
    {
        return app(EscrowTimingService::class);
    }

    public function test_digital_funds_release_48_hours_after_delivery(): void
    {
        [$buyer, $seller] = $this->parties();
        $escrow = $this->escrow($buyer, $seller);

        $this->service()->recordDelivery($escrow, 'digital');

        $this->assertEquals($this->start->copy()->addHours(48)->toIso8601String(), $escrow->fresh()->release_at->toIso8601String());
    }

    public function test_physical_without_receipt_releases_10_days_after_delivery(): void
    {
        [$buyer, $seller] = $this->parties();
        $escrow = $this->escrow($buyer, $seller);

        $this->service()->recordDelivery($escrow, 'physical');

        $this->assertEquals($this->start->copy()->addDays(10)->toIso8601String(), $escrow->fresh()->release_at->toIso8601String());
    }

    public function test_physical_receipt_within_3_days_releases_7_days_after_receipt(): void
    {
        [$buyer, $seller] = $this->parties();
        $escrow = $this->escrow($buyer, $seller);
        $this->service()->recordDelivery($escrow, 'physical');

        Carbon::setTestNow($this->start->copy()->addDays(2));
        $this->service()->recordBuyerReceipt($escrow->fresh(), $buyer);

        $this->assertEquals($this->start->copy()->addDays(9)->toIso8601String(), $escrow->fresh()->release_at->toIso8601String());
    }

    public function test_receipt_after_3_days_does_not_extend_past_the_10_day_rule(): void
    {
        [$buyer, $seller] = $this->parties();
        $escrow = $this->escrow($buyer, $seller);
        $this->service()->recordDelivery($escrow, 'physical');

        Carbon::setTestNow($this->start->copy()->addDays(5));
        $this->service()->recordBuyerReceipt($escrow->fresh(), $buyer);

        $this->assertEquals($this->start->copy()->addDays(10)->toIso8601String(), $escrow->fresh()->release_at->toIso8601String());
    }

    public function test_an_escrow_with_no_delivery_is_held_not_refunded_and_nobody_is_notified(): void
    {
        [$buyer, $seller] = $this->parties();
        $escrow = $this->escrow($buyer, $seller);

        Carbon::setTestNow($this->start->copy()->addDays(15));
        $counts = $this->service()->processDue();

        $escrow->refresh();
        $this->assertSame('on_hold', $escrow->status);
        $this->assertSame('no_delivery', $escrow->hold_reason);
        $this->assertSame(1, $counts['held_no_delivery']);
        $this->assertSame(0, $buyer->notifications()->count());
        $this->assertSame(0, $seller->notifications()->count());
    }

    public function test_due_delivered_escrow_is_released_to_the_seller(): void
    {
        [$buyer, $seller] = $this->parties();
        app(WalletService::class)->getOrCreateWallet($buyer, 'system')->update(['available' => 40000]);
        $escrow = $this->escrow($buyer, $seller);
        $this->service()->recordDelivery($escrow, 'digital');

        Carbon::setTestNow($this->start->copy()->addHours(49));
        $counts = $this->service()->processDue();

        $this->assertSame('released', $escrow->fresh()->status);
        $this->assertSame(1, $counts['released']);
    }

    public function test_a_delivery_recorded_during_a_hold_never_releases_and_raises_a_critical_alert(): void
    {
        [$buyer, $seller] = $this->parties();
        $escrow = $this->escrow($buyer, $seller);

        Carbon::setTestNow($this->start->copy()->addDays(15));
        $this->service()->processDue();
        $this->assertSame('on_hold', $escrow->fresh()->status);

        $this->service()->recordDelivery($escrow->fresh(), 'physical');

        $escrow->refresh();
        $this->assertSame('on_hold', $escrow->status, 'A delivery after a hold must not release funds.');
        $this->assertNotNull($escrow->delivery_alert_at);
        $this->assertDatabaseHas('admin_alerts', [
            'event_type' => 'escrow_delivery_after_hold',
            'severity' => 'critical',
            'reference' => "escrow:{$escrow->id}",
        ]);
    }

    public function test_manual_hold_notifies_both_parties_only_when_a_delivery_was_sent(): void
    {
        [$buyer, $seller] = $this->parties();
        $undelivered = $this->escrow($buyer, $seller);
        $delivered = $this->escrow($buyer, $seller);
        $this->service()->recordDelivery($delivered, 'physical');
        $staff = User::factory()->create(['role' => 'admin', 'admin_role' => 'super_admin']);

        $buyerBefore = $buyer->notifications()->count();
        $sellerBefore = $seller->notifications()->count();

        $this->service()->holdManually($undelivered->fresh(), $staff, 'Checking the order details');
        $this->assertSame($buyerBefore, $buyer->notifications()->count(), 'No hold notice without a delivery.');
        $this->assertSame($sellerBefore, $seller->notifications()->count());

        $this->service()->holdManually($delivered->fresh(), $staff, 'Checking the delivery');
        $this->assertSame($buyerBefore + 1, $buyer->notifications()->count());
        $this->assertSame($sellerBefore + 1, $seller->notifications()->count());
        $this->assertDatabaseHas('audit_logs', ['action' => 'escrow.hold', 'resource_id' => (string) $delivered->id]);
    }

    public function test_buyer_can_release_an_on_hold_escrow_now(): void
    {
        [$buyer, $seller] = $this->parties();
        app(WalletService::class)->getOrCreateWallet($buyer, 'system')->update(['available' => 40000]);
        $escrow = $this->escrow($buyer, $seller);
        $escrow->update(['status' => 'on_hold', 'hold_reason' => 'no_delivery']);

        $this->actingAsSession($buyer)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/release-now")
            ->assertOk();

        $this->assertSame('released', $escrow->fresh()->status);
    }

    public function test_seller_cannot_release_an_escrow_early(): void
    {
        [$buyer, $seller] = $this->parties();
        $escrow = $this->escrow($buyer, $seller);

        $this->actingAsSession($seller)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/release-now")
            ->assertStatus(403);
    }

    public function test_counterparty_phone_is_shared_only_on_a_paid_order_with_a_participant(): void
    {
        [$buyer, $seller] = $this->parties();
        $outsider = User::factory()->create(['role' => 'member']);
        $escrow = $this->escrow($buyer, $seller);

        // The API wraps every body in a success envelope, so the payload sits under data.data.
        $body = $this->actingAsSession($buyer)
            ->getJson("/api/v1/wallet/escrow/{$escrow->id}/counterparty-contact")
            ->assertOk()
            ->json('data.data');
        $this->assertSame('+2348030000002', $body['mobile_number']);

        $this->actingAsSession($outsider)
            ->getJson("/api/v1/wallet/escrow/{$escrow->id}/counterparty-contact")
            ->assertStatus(403);

        $escrow->update(['status' => 'refunded']);
        $this->actingAsSession($buyer)
            ->getJson("/api/v1/wallet/escrow/{$escrow->id}/counterparty-contact")
            ->assertStatus(403);
    }

    public function test_staff_hold_needs_fund_level_access(): void
    {
        [$buyer, $seller] = $this->parties();
        $escrow = $this->escrow($buyer, $seller);

        $support = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'support_admin',
            'admin_permissions' => ['support'],
        ]);
        $this->actingAsSession($support)
            ->postJson("/api/v1/securegate/escrow/{$escrow->id}/hold", ['reason' => 'Trying to freeze'])
            ->assertStatus(403);

        $finance = User::factory()->create([
            'role' => 'admin',
            'admin_role' => 'finance_admin',
            'admin_permissions' => ['wallets'],
        ]);
        $this->actingAsSession($finance)
            ->postJson("/api/v1/securegate/escrow/{$escrow->id}/hold", ['reason' => 'Suspected duplicate claim'])
            ->assertOk();

        $this->assertSame('on_hold', $escrow->fresh()->status);
    }

    public function test_buyer_cannot_lift_a_staff_hold(): void
    {
        [$buyer, $seller] = $this->parties();
        app(WalletService::class)->getOrCreateWallet($buyer, 'system')->update(['available' => 40000]);
        $escrow = $this->escrow($buyer, $seller);
        $escrow->update(['status' => 'on_hold', 'hold_reason' => 'manual: Suspected collusion']);

        $this->actingAsSession($buyer)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/release-now")
            ->assertStatus(422);

        $this->assertSame('on_hold', $escrow->fresh()->status);
    }

    public function test_cancelling_a_dispute_raised_on_a_staff_hold_keeps_the_hold(): void
    {
        [$buyer, $seller] = $this->parties();
        $escrow = $this->escrow($buyer, $seller);
        $escrow->update(['status' => 'on_hold', 'hold_reason' => 'manual: Suspected collusion']);

        $this->actingAsSession($buyer)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/dispute", ['reason' => 'The seller never delivered the item.'])
            ->assertStatus(201);

        $dispute = Dispute::where('escrow_id', $escrow->id)->firstOrFail();
        $admin = User::factory()->create(['role' => 'admin', 'admin_role' => 'super_admin']);

        app(EscrowService::class)->resolveDispute($dispute, 'cancelled', $admin->id);

        $this->assertSame('on_hold', $escrow->fresh()->status);
    }
}
