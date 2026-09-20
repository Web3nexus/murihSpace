<?php

namespace Tests\Feature\Payment;

use App\Enums\PaymentStatus;
use App\Models\CoinPack;
use App\Models\CoinPurchase;
use App\Models\DepositTransaction;
use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\Payment;
use App\Models\User;
use App\Services\Payment\DTO\PaymentVerificationResult;
use App\Services\Payment\PaymentService;
use App\Services\Wallet\FeeCalculatorService;
use App\Services\Wallet\WalletService;
use App\Models\AdminSetting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaddleFulfillmentTest extends TestCase
{
    use RefreshDatabase;

    private function finalize(Payment $payment, int $amount, string $currency = 'USD'): void
    {
        $service = app(PaymentService::class);
        $verification = new PaymentVerificationResult(
            isSuccessful: true,
            status: PaymentStatus::Successful,
            providerReference: 'txn_paddle_test_1',
            providerTransactionId: 'txn_paddle_test_1',
            amount: $amount,
            currency: $currency
        );

        $service->finalizePayment($payment, $verification);
    }

    public function test_completed_coin_pack_webhook_credits_coins_and_creates_record(): void
    {
        AdminSetting::set('coin_conversion_rate', 10);
        $pack = CoinPack::create([
            'name' => 'Starter', 'coins' => 100, 'bonus_coins' => 25,
            'price' => 1000, 'currency' => 'USD', 'sort_order' => 1,
        ]);
        $user = User::factory()->create();

        $payment = Payment::create([
            'provider' => 'paddle',
            'user_id' => $user->id,
            'transaction_type' => 'coin_pack',
            'payment_method' => 'card',
            'amount' => 1000,
            'currency' => 'USD',
            'fees' => 0,
            'net_amount' => 1000,
            'status' => PaymentStatus::Processing,
            'idempotency_key' => 'idem-cp-1',
            'metadata' => [
                'coin_pack_id' => $pack->id,
                'tax' => 0,
                'total_charged' => 1000,
                'tax_rate' => 0.0,
                'tax_type' => 'provider_handled',
                'coin_conversion_rate' => 10,
            ],
        ]);

        $this->finalize($payment, 1000);

        $payment->refresh();
        $this->assertTrue($payment->isSuccessful());

        $wallet = (new WalletService())->getOrCreateWallet($user, 'system');
        $this->assertSame(125, (int) $wallet->available);

        $purchases = CoinPurchase::where('user_id', $user->id)->get();
        $this->assertCount(1, $purchases);
        $this->assertSame(100, (int) $purchases->first()->coins);
        $this->assertSame(25, (int) $purchases->first()->bonus_coins);
        $this->assertSame('paddle', $purchases->first()->provider);
        $this->assertSame('provider_handled', $purchases->first()->tax_type);
    }

    public function test_completed_wallet_topup_webhook_credits_balance(): void
    {
        $user = User::factory()->create();

        $payment = Payment::create([
            'provider' => 'paddle',
            'user_id' => $user->id,
            'transaction_type' => 'wallet_topup',
            'payment_method' => 'card',
            'amount' => 5000,
            'currency' => 'USD',
            'fees' => 0,
            'net_amount' => 5000,
            'status' => PaymentStatus::Processing,
            'idempotency_key' => 'idem-wt-1',
            'metadata' => [
                'wallet_topup' => true,
                'tax' => 0,
                'total_charged' => 5000,
                'tax_type' => 'provider_handled',
            ],
        ]);

        $this->finalize($payment, 5000);

        $wallet = (new WalletService())->getOrCreateWallet($user, 'system');
        $this->assertSame(5000, (int) $wallet->available);

        $this->assertSame(1, DepositTransaction::where('user_id', $user->id)->count());
        $this->assertSame('completed', DepositTransaction::first()->status);
    }

    public function test_completed_gift_purchase_webhook_settles_gift_with_ledger_balance(): void
    {
        $sender = User::factory()->create(['role' => 'member']);
        $recipient = User::factory()->create(['role' => 'creator']);
        $platform = User::factory()->create(['role' => 'admin']);
        config()->set('wallet.platform_revenue_user_id', $platform->id);

        AdminSetting::set('coin_conversion_rate', 10);
        $gift = Gift::create([
            'name' => 'Rose',
            'coin_price' => 50,
            'creator_earns' => 45,
            'platform_commission' => 5,
            'icon' => '🌹',
            'is_active' => true,
        ]);

        $payment = Payment::create([
            'provider' => 'paddle',
            'user_id' => $sender->id,
            'transaction_type' => 'gift',
            'payment_method' => 'card',
            'amount' => 500, // $5.00 -> 50 coins at 10/USD
            'currency' => 'USD',
            'fees' => 0,
            'net_amount' => 500,
            'status' => PaymentStatus::Processing,
            'idempotency_key' => 'idem-gift-1',
            'metadata' => [
                'gift_id' => $gift->id,
                'recipient_id' => $recipient->id,
                'coin_conversion_rate' => 10,
                'is_anonymous' => false,
                'is_public' => true,
            ],
        ]);

        $this->finalize($payment, 500);

        $feeRes = app(FeeCalculatorService::class)->calculate('GIFT_RECEIVING', 50, 'USD');
        $net = (int) $feeRes['net_amount'];

        $txn = GiftTransaction::where('sender_id', $sender->id)->first();
        $this->assertNotNull($txn);
        $this->assertSame($gift->id, (int) $txn->gift_id);
        $this->assertSame('completed', $txn->status);

        $walletService = new WalletService();
        // Sender funded 50 coins then paid the 50 gift -> net zero
        $this->assertSame(0, (int) $walletService->getOrCreateWallet($sender, 'system')->available);
        // Recipient creator wallet receives net of fee
        $this->assertSame($net, (int) $walletService->getOrCreateWallet($recipient, 'creator')->available);
        // Fee floated to platform revenue
        $this->assertSame(50 - $net, (int) $walletService->getOrCreateWallet($platform, 'system')->available);
    }
}