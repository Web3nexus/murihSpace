<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Wallet;
use App\Services\Wallet\WalletService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsSession;
use Tests\TestCase;

class WalletKycWithdrawPromptTest extends TestCase
{
    use ActsAsSession;
    use RefreshDatabase;

    private function creatorWithWithdrawable(string $kycStatus): User
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => $kycStatus]);
        (new WalletService())->getOrCreateWallet($user, 'creator');
        Wallet::where('user_id', $user->id)->where('wallet_type', 'creator')->update(['withdrawable' => 2500]);

        return $user;
    }

    private function creatorWallet(array $body): array
    {
        // The API wraps lists in a `data` envelope, so the wallets sit under data.data.
        return collect($body['data']['data'] ?? $body['data'] ?? [])->firstWhere('wallet_type', 'creator');
    }

    public function test_unverified_user_with_withdrawable_money_is_prompted_to_verify(): void
    {
        $user = $this->creatorWithWithdrawable('not_started');

        $body = $this->actingAsSession($user)->getJson('/api/v1/wallet')->assertOk()->json();

        $this->assertTrue($this->creatorWallet($body)['kyc_required_to_withdraw']);
    }

    public function test_verified_user_is_not_prompted(): void
    {
        $user = $this->creatorWithWithdrawable('verified');

        $body = $this->actingAsSession($user)->getJson('/api/v1/wallet')->assertOk()->json();

        $this->assertFalse($this->creatorWallet($body)['kyc_required_to_withdraw']);
    }

    public function test_unverified_user_with_nothing_withdrawable_is_not_prompted(): void
    {
        $user = User::factory()->create(['role' => 'creator', 'kyc_status' => 'not_started']);
        (new WalletService())->getOrCreateWallet($user, 'creator');

        $body = $this->actingAsSession($user)->getJson('/api/v1/wallet')->assertOk()->json();

        $this->assertFalse($this->creatorWallet($body)['kyc_required_to_withdraw']);
    }
}
