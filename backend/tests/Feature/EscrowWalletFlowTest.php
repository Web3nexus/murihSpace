<?php

namespace Tests\Feature;

use App\Models\Dispute;
use App\Models\Escrow;
use App\Models\LedgerTransaction;
use App\Models\User;
use App\Models\Wallet;
use App\Services\Escrow\EscrowService;
use App\Services\Payment\Exceptions\PaymentException;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

/**
 * Regression cover for the wallet-backed escrow admin/seller endpoints
 * (EscrowController::release/refund), which move real wallet balances.
 */
class EscrowWalletFlowTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function fundWallet(User $user, string $type, int $available): void
    {
        $wallet = (new WalletService())->getOrCreateWallet($user, $type);
        $wallet->update(['available' => $available]);
    }

    private function balance(User $user, string $type, string $category = 'available'): int
    {
        $wallet = Wallet::where('user_id', $user->id)->where('wallet_type', $type)->first();
        return (int) ($wallet?->{$category} ?? 0);
    }

    private function escrow(User $buyer, User $seller, int $amount = 50000): Escrow
    {
        return Escrow::create([
            'buyer_id' => $buyer->id,
            'seller_id' => $seller->id,
            'amount' => $amount,
            'currency' => 'USD',
            'status' => 'held',
        ]);
    }

    public function test_seller_can_release_held_escrow_and_is_credited(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $seller->forceFill(['kyc_status' => 'verified'])->save();

        $this->fundWallet($buyer, 'system', 50000);
        $escrow = $this->escrow($buyer, $seller, 50000);

        $response = $this->actingAs($seller)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/release");

        $response->assertOk()->assertJsonPath('message', 'Escrow released to seller.');

        $this->assertSame(50000, $this->balance($seller, 'creator'));
        // The buyer is NOT debited: their funds were collected externally
        // (Paddle), so releasing must not double-charge the wallet.
        $this->assertSame(50000, $this->balance($buyer, 'system'));
        $this->assertSame('released', $escrow->fresh()->status);
        $this->assertNotNull($escrow->fresh()->released_at);
        $this->assertDatabaseHas('ledger_transactions', [
            'idempotency_key' => "ESCROW_RELEASE_{$escrow->id}",
        ]);
    }

    public function test_release_is_rejected_once_escrow_is_no_longer_held(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $seller->forceFill(['kyc_status' => 'verified'])->save();

        $this->fundWallet($buyer, 'system', 50000);
        $escrow = $this->escrow($buyer, $seller, 50000);

        $this->actingAs($seller)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/release")
            ->assertOk();

        $this->actingAs($seller)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/release")
            ->assertStatus(400);

        // Second call must not credit the seller again.
        $this->assertSame(50000, $this->balance($seller, 'creator'));
        $this->assertSame(
            1,
            LedgerTransaction::where('idempotency_key', "ESCROW_RELEASE_{$escrow->id}")->count()
        );
    }

    public function test_non_seller_cannot_release_escrow(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $stranger = User::factory()->create(['role' => 'member']);

        $this->fundWallet($buyer, 'system', 50000);
        $escrow = $this->escrow($buyer, $seller, 50000);

        $this->actingAs($stranger)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/release")
            ->assertForbidden();

        $this->assertSame('held', $escrow->fresh()->status);
    }

    public function test_release_by_seller_requires_verified_kyc(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);

        $this->fundWallet($buyer, 'system', 50000);
        $escrow = $this->escrow($buyer, $seller, 50000);

        $this->actingAs($seller)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/release")
            ->assertForbidden();

        $this->assertSame('held', $escrow->fresh()->status);
    }

    public function test_admin_can_refund_held_escrow_to_buyer(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);

        $this->fundWallet($seller, 'creator', 50000);
        $escrow = $this->escrow($buyer, $seller, 50000);

        $this->actAsSession($admin)
            ->postJson("/api/v1/securegate/escrow/{$escrow->id}/refund")
            ->assertOk()->assertJsonPath('message', 'Escrow refunded to buyer.');

        $this->assertSame(50000, $this->balance($buyer, 'system'));
        // The seller is NOT debited: funds were never credited on a refund
        // from `held`, so clawing back would 500 on a short wallet.
        $this->assertSame(50000, $this->balance($seller, 'creator'));
        $this->assertSame('refunded', $escrow->fresh()->status);
        $this->assertNotNull($escrow->fresh()->refunded_at);
        $this->assertDatabaseHas('ledger_transactions', [
            'idempotency_key' => "ESCROW_REFUND_{$escrow->id}",
        ]);
    }

    public function test_non_admin_cannot_refund_escrow(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);

        $escrow = $this->escrow($buyer, $seller, 50000);

        $this->actingAs($seller)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/refund")
            ->assertForbidden();

        $this->assertSame('held', $escrow->fresh()->status);
    }

    public function test_escrow_index_is_scoped_to_the_participant(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $outsider = User::factory()->create(['role' => 'member']);

        $this->escrow($buyer, $seller, 50000);

        $this->actingAs($outsider)
            ->getJson('/api/v1/wallet/escrow')
            ->assertOk()
            ->assertJsonCount(0, 'data.data');

        $this->actingAs($buyer)
            ->getJson('/api/v1/wallet/escrow')
            ->assertOk()
            ->assertJsonCount(1, 'data.data');
    }

    /**
     * Regression: release used to debit the buyer's wallet, which threw an
     * uncaught RuntimeException (HTTP 500) whenever the buyer was short — even
     * though the buyer's funds were collected externally and never sat in the
     * wallet. Release must succeed regardless of the buyer's balance.
     */
    public function test_release_succeeds_even_when_buyer_wallet_is_empty(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $seller->forceFill(['kyc_status' => 'verified'])->save();

        // Buyer has no wallet funds at all.
        $escrow = $this->escrow($buyer, $seller, 50000);

        $this->actingAs($seller)
            ->postJson("/api/v1/wallet/escrow/{$escrow->id}/release")
            ->assertOk();

        $this->assertSame(50000, $this->balance($seller, 'creator'));
        $this->assertSame('released', $escrow->fresh()->status);
    }

    /**
     * Regression: refund used to debit the seller's wallet, which 500'd when the
     * seller had no funds (the common case for a refund from `held`).
     */
    public function test_refund_succeeds_even_when_seller_wallet_is_empty(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);

        // Seller has no wallet funds at all.
        $escrow = $this->escrow($buyer, $seller, 50000);

        $this->actAsSession($admin)
            ->postJson("/api/v1/securegate/escrow/{$escrow->id}/refund")
            ->assertOk();

        $this->assertSame(50000, $this->balance($buyer, 'system'));
        $this->assertSame('refunded', $escrow->fresh()->status);
    }

    /**
     * captured_at must actually persist (the column used to not exist, so the
     * write was silently dropped).
     */
    public function test_capture_records_captured_at_on_held_escrow(): void
    {
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $escrow = $this->escrow($buyer, $seller, 50000);

        $this->assertNull($escrow->captured_at);

        app(EscrowService::class)->capture($escrow);

        $this->assertNotNull($escrow->fresh()->captured_at);
        $this->assertSame('held', $escrow->fresh()->status);
    }

    private function openDispute(Escrow $escrow, User $by, string $reason = 'Item never delivered as described.'): Dispute
    {
        $escrow->update(['status' => 'disputed']);

        return Dispute::create([
            'escrow_id' => $escrow->id,
            'raised_by' => $by->id,
            'reason' => $reason,
            'status' => 'open',
        ]);
    }

    /**
     * Regression: a dispute sits on a `disputed` escrow, but the pre-consolidation
     * resolve-path wrote ledger rows inline. Resolving in the seller's favour must
     * now go through EscrowService (shared release primitive) and must NOT be
     * blocked by the `held`-only release guard.
     */
    public function test_admin_resolving_dispute_for_seller_releases_from_disputed(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $escrow = $this->escrow($buyer, $seller, 50000);
        $dispute = $this->openDispute($escrow, $buyer);

        app(EscrowService::class)->resolveDispute($dispute, 'resolved_seller', $admin->id, 'Seller delivered.');

        $this->assertSame(50000, $this->balance($seller, 'creator'));
        $this->assertSame(0, $this->balance($buyer, 'system'));
        $escrow->refresh();
        $this->assertSame('released', $escrow->status);
        $this->assertNotNull($escrow->released_at);

        $dispute->refresh();
        $this->assertSame('resolved_seller', $dispute->status);
        $this->assertSame($admin->id, $dispute->admin_id);
        $this->assertSame('Seller delivered.', $dispute->resolution_note);
        $this->assertNotNull($dispute->resolved_at);
        $this->assertDatabaseHas('ledger_transactions', [
            'idempotency_key' => "ESCROW_RELEASE_{$escrow->id}",
        ]);
    }

    public function test_admin_resolving_dispute_for_buyer_refunds_from_disputed(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $escrow = $this->escrow($buyer, $seller, 50000);
        $dispute = $this->openDispute($escrow, $buyer);

        app(EscrowService::class)->resolveDispute($dispute, 'resolved_buyer', $admin->id, 'Not delivered.');

        $this->assertSame(50000, $this->balance($buyer, 'system'));
        $this->assertSame(0, $this->balance($seller, 'creator'));
        $escrow->refresh();
        $this->assertSame('refunded', $escrow->status);
        $this->assertNotNull($escrow->refunded_at);

        $dispute->refresh();
        $this->assertSame('resolved_buyer', $dispute->status);
        $this->assertSame($admin->id, $dispute->admin_id);
        $this->assertDatabaseHas('ledger_transactions', [
            'idempotency_key' => "ESCROW_REFUND_{$escrow->id}",
        ]);
    }

    public function test_cancelling_a_dispute_returns_escrow_to_held_without_wallet_movement(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $escrow = $this->escrow($buyer, $seller, 50000);
        $dispute = $this->openDispute($escrow, $buyer);

        app(EscrowService::class)->resolveDispute($dispute, 'cancelled', $admin->id, 'Withdrawn.');

        $escrow->refresh();
        $this->assertSame('held', $escrow->status);
        $this->assertSame(0, $this->balance($buyer, 'system'));
        $this->assertSame(0, $this->balance($seller, 'creator'));
        $this->assertSame('cancelled', $dispute->fresh()->status);
    }

    public function test_resolving_a_dispute_moves_funds_exactly_once(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $escrow = $this->escrow($buyer, $seller, 50000);
        $dispute = $this->openDispute($escrow, $buyer);

        $service = app(EscrowService::class);
        $service->resolveDispute($dispute, 'resolved_seller', $admin->id, null);

        // A second resolution is rejected: the escrow is no longer `disputed`,
        // so the seller can never be paid a second time.
        $this->expectException(PaymentException::class);
        $service->resolveDispute($dispute->fresh(), 'resolved_seller', $admin->id, null);
    }

    /**
     * Regression: refunding a disputed escrow must settle the open dispute, so a
     * subsequent admin resolution cannot release the same funds to the seller.
     */
    public function test_refunding_a_disputed_escrow_closes_the_dispute_and_blocks_double_payout(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $escrow = $this->escrow($buyer, $seller, 50000);
        $dispute = $this->openDispute($escrow, $buyer);

        app(EscrowService::class)->refund($escrow->fresh(), $admin->id, 'Refunded during review.');

        $this->assertSame(50000, $this->balance($buyer, 'system'));
        $this->assertSame('refunded', $escrow->fresh()->status);
        $this->assertSame('resolved_buyer', $dispute->fresh()->status);

        // Attempting to then release to the seller must fail: escrow is refunded.
        try {
            app(EscrowService::class)->resolveDispute($dispute->fresh(), 'resolved_seller', $admin->id, null);
            $this->fail('Expected the seller resolution to be rejected.');
        } catch (PaymentException $e) {
            $this->assertSame('ESCROW_NOT_DISPUTED', $e->errorCode);
        }

        $this->assertSame(0, $this->balance($seller, 'creator'));
    }

    public function test_admin_resolves_dispute_via_http_endpoint(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $buyer = User::factory()->create(['role' => 'member']);
        $seller = User::factory()->create(['role' => 'creator']);
        $escrow = $this->escrow($buyer, $seller, 50000);
        $dispute = $this->openDispute($escrow, $buyer);

        $this->actAsSession($admin)
            ->putJson("/api/v1/securegate/escrow/disputes/{$dispute->id}/resolve", [
                'resolution' => 'resolved_buyer',
                'resolution_note' => 'Refund approved.',
            ])
            ->assertOk();

        $this->assertSame(50000, $this->balance($buyer, 'system'));
        $this->assertSame('refunded', $escrow->fresh()->status);
        $this->assertSame('resolved_buyer', $dispute->fresh()->status);
    }
}
