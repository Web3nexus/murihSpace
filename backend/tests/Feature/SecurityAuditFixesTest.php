<?php

namespace Tests\Feature;

use App\Models\PendingLoginRequest;
use App\Models\User;
use App\Services\Wallet\LedgerService;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SecurityAuditFixesTest extends TestCase
{
    use RefreshDatabase;

    public function test_replaying_an_earnings_credit_does_not_repay_debt_twice(): void
    {
        $seller = User::factory()->create(['role' => 'creator']);
        $wallet = app(WalletService::class)->getOrCreateWallet($seller, 'creator');
        $wallet->update(['debt' => 20000]);

        $ledger = app(LedgerService::class);
        $credit = fn () => $ledger->creditEarnings(
            user: $seller,
            amount: 10000,
            currency: 'USD',
            walletType: 'creator',
            balanceCategory: 'available',
            type: 'escrow_release',
            description: 'Escrow release',
            idempotencyKey: 'EARN-REPLAY-1',
        );

        $credit();
        $credit();

        $wallet->refresh();
        $this->assertSame(10000, (int) $wallet->debt, 'A replayed credit must not reduce the debt again.');
        $this->assertSame(0, (int) $wallet->available);
    }

    public function test_device_approval_token_is_delivered_only_once(): void
    {
        $user = User::factory()->create();

        $pending = PendingLoginRequest::create([
            'user_id' => $user->id,
            'request_token' => 'req_once_789',
            'device_id' => 'device_once_uuid',
            'device_name' => 'Pixel 9',
            'platform' => 'android',
            'status' => 'pending',
            'expires_at' => now()->addMinutes(5),
        ]);

        $this->actingAs($user)
            ->postJson("/api/v1/auth/device-approval/{$pending->id}/approve")
            ->assertStatus(200);

        $this->getJson('/api/v1/auth/device-approval/check-status/req_once_789')
            ->assertStatus(200)
            ->assertJsonPath('data.status', 'approved');

        $this->getJson('/api/v1/auth/device-approval/check-status/req_once_789')
            ->assertStatus(410);

        $this->assertNull($pending->fresh()->authorized_token);
    }
}
