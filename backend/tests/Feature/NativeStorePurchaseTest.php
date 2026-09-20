<?php

namespace Tests\Feature;

use App\Models\CoinPack;
use App\Models\CoinPurchase;
use App\Models\NativeStorePurchase;
use App\Models\User;
use App\Services\NativeStore\Contracts\StoreVerifier;
use App\Services\NativeStore\StoreVerificationResult;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NativeStorePurchaseTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'payments.stores.apple.enabled' => true,
            'payments.stores.google.enabled' => true,
        ]);
    }

    private function pack(array $overrides = []): CoinPack
    {
        return CoinPack::create(array_merge([
            'name' => 'Popular',
            'coins' => 250,
            'bonus_coins' => 25,
            'price' => 2500,
            'currency' => 'USD',
            'is_active' => true,
            'sort_order' => 1,
            'store_product_ios' => 'com.murihspace.coins.275.ios',
            'store_product_android' => 'com.murihspace.coins.275.android',
        ], $overrides));
    }

    public function test_native_intent_requires_authentication(): void
    {
        $response = $this->postJson('/api/v1/coins/native-intent', [
            'coin_pack_id' => 1,
            'store' => 'apple',
        ]);

        $response->assertStatus(401);
    }

    public function test_native_intent_returns_configured_product_id(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $pack = $this->pack();

        $response = $this->actingAs($user)->postJson('/api/v1/coins/native-intent', [
            'coin_pack_id' => $pack->id,
            'store' => 'apple',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.product_id', 'com.murihspace.coins.275.ios');
        $response->assertJsonPath('data.store', 'apple');
        $response->assertJsonPath('data.total_coins', 275);
        $response->assertJsonPath('data.coins', 250);
    }

    public function test_native_intent_auto_derives_product_id_when_not_set(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $pack = $this->pack([
            'store_product_ios' => null,
            'store_product_android' => null,
        ]);

        $response = $this->actingAs($user)->postJson('/api/v1/coins/native-intent', [
            'coin_pack_id' => $pack->id,
            'store' => 'google',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.product_id', 'com.murihspace.coins.275');
    }

    public function test_native_verify_credits_user_wallet_and_is_idempotent(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $pack = $this->pack();

        // Bind mock AppleStoreVerifier into container
        $mockVerifier = new class extends \App\Services\NativeStore\AppleStoreVerifier {
            public function verify(string $productId, string $token, ?string $expectedTransactionId = null): StoreVerificationResult
            {
                return StoreVerificationResult::success(
                    store: 'apple',
                    productId: $productId,
                    transactionId: $expectedTransactionId ?: 'txn_apple_12345',
                    orderId: null,
                    payload: ['environment' => 'Sandbox']
                );
            }
        };

        $this->app->instance(\App\Services\NativeStore\AppleStoreVerifier::class, $mockVerifier);

        $payload = [
            'coin_pack_id' => $pack->id,
            'store' => 'apple',
            'product_id' => 'com.murihspace.coins.275.ios',
            'token' => 'sample_base64_receipt_data',
            'transaction_id' => 'txn_apple_12345',
        ];

        // 1. Initial verification call
        $response = $this->actingAs($user)->postJson('/api/v1/coins/native-verify', $payload);

        $response->assertStatus(201);
        $response->assertJsonPath('data.credited_coins', 275);
        $response->assertJsonPath('data.status', 'completed');
        $response->assertJsonPath('data.transaction_id', 'txn_apple_12345');

        // Check NativeStorePurchase row in DB
        $this->assertDatabaseHas('native_store_purchases', [
            'user_id' => $user->id,
            'store' => 'apple',
            'store_transaction_id' => 'txn_apple_12345',
            'credited_coins' => 275,
            'status' => 'completed',
        ]);

        // Check CoinPurchase row
        $this->assertDatabaseHas('coin_purchases', [
            'user_id' => $user->id,
            'provider' => 'apple_store',
            'tax_type' => 'provider_handled',
            'coins' => 250,
            'bonus_coins' => 25,
        ]);

        // 2. Duplicate submission by same user should be idempotent
        $dupResponse = $this->actingAs($user)->postJson('/api/v1/coins/native-verify', $payload);

        $dupResponse->assertStatus(200);
        $dupResponse->assertJsonPath('data.credited_coins', 275);
        $dupResponse->assertJsonPath('data.status', 'completed');

        // Verify no double ledger credit or double purchase row
        $this->assertSame(1, NativeStorePurchase::where('store_transaction_id', 'txn_apple_12345')->count());
        $this->assertSame(1, CoinPurchase::where('user_id', $user->id)->count());

        // 3. Attempt by another user to claim the same transaction must be blocked (IDOR protection)
        $anotherUser = User::factory()->create(['email_verified_at' => now()]);
        $hijackResponse = $this->actingAs($anotherUser)->postJson('/api/v1/coins/native-verify', $payload);

        $hijackResponse->assertStatus(422);
        $this->assertSame(0, CoinPurchase::where('user_id', $anotherUser->id)->count());
    }

    public function test_native_verify_fails_with_invalid_token(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $pack = $this->pack();

        $mockVerifier = new class extends \App\Services\NativeStore\AppleStoreVerifier {
            public function verify(string $productId, string $token, ?string $expectedTransactionId = null): StoreVerificationResult
            {
                return StoreVerificationResult::failure(
                    store: 'apple',
                    error: 'The receipt could not be verified by Apple (status: 21002).'
                );
            }
        };

        $this->app->instance(\App\Services\NativeStore\AppleStoreVerifier::class, $mockVerifier);

        $response = $this->actingAs($user)->postJson('/api/v1/coins/native-verify', [
            'coin_pack_id' => $pack->id,
            'store' => 'apple',
            'product_id' => 'com.murihspace.coins.275.ios',
            'token' => 'corrupt_receipt',
            'transaction_id' => 'txn_fail_1',
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseMissing('native_store_purchases', [
            'store_transaction_id' => 'txn_fail_1',
        ]);
    }

    public function test_apple_webhook_marks_purchase_as_revoked(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $pack = $this->pack();

        $purchase = NativeStorePurchase::create([
            'user_id' => $user->id,
            'coin_pack_id' => $pack->id,
            'store' => 'apple',
            'store_transaction_id' => 'txn_apple_refund_1',
            'product_id' => 'com.murihspace.coins.275',
            'amount_minor' => 2500,
            'currency' => 'USD',
            'credited_coins' => 275,
            'status' => 'completed',
            'internal_reference' => 'NSP-A-12345678',
        ]);

        $txnJws = 'header.' . rtrim(strtr(base64_encode(json_encode(['transactionId' => 'txn_apple_refund_1'])), '+/', '-_'), '=') . '.sig';
        $payloadJws = 'header.' . rtrim(strtr(base64_encode(json_encode([
            'notificationType' => 'REFUND',
            'data' => ['signedTransactionInfo' => $txnJws],
        ])), '+/', '-_'), '=') . '.sig';

        $response = $this->postJson('/api/v1/webhooks/apple-store', [
            'signedPayload' => $payloadJws,
        ]);

        $response->assertStatus(200);
        $this->assertSame('revoked', $purchase->fresh()->status);
    }

    public function test_google_webhook_marks_purchase_as_revoked(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        $pack = $this->pack();

        $purchase = NativeStorePurchase::create([
            'user_id' => $user->id,
            'coin_pack_id' => $pack->id,
            'store' => 'google',
            'store_transaction_id' => 'token_google_refund_1',
            'product_id' => 'com.murihspace.coins.275',
            'amount_minor' => 2500,
            'currency' => 'USD',
            'credited_coins' => 275,
            'status' => 'completed',
            'internal_reference' => 'NSP-G-12345678',
        ]);

        $data = base64_encode(json_encode([
            'oneTimeProductNotification' => [
                'notificationType' => 3, // Canceled / refunded
                'purchaseToken' => 'token_google_refund_1',
            ],
        ]));

        $response = $this->postJson('/api/v1/webhooks/google-play', [
            'message' => [
                'data' => $data,
            ],
        ]);

        $response->assertStatus(200);
        $this->assertSame('revoked', $purchase->fresh()->status);
    }

    public function test_apple_store_verifier_matches_specific_transaction_in_multi_entry_receipt(): void
    {
        config([
            'payments.stores.apple.enabled' => true,
            'payments.stores.apple.shared_secret' => 'test_secret_123',
            'payments.stores.apple.bundle_id' => 'com.murihspace.app',
            'payments.stores.apple.verify_receipt_url' => 'https://buy.itunes.apple.com/verifyReceipt',
            'payments.stores.apple.verify_receipt_sandbox_url' => 'https://sandbox.itunes.apple.com/verifyReceipt',
        ]);

        \Illuminate\Support\Facades\Http::fake([
            'https://sandbox.itunes.apple.com/verifyReceipt' => \Illuminate\Support\Facades\Http::response([
                'status' => 0,
                'receipt' => [
                    'bundle_id' => 'com.murihspace.app',
                    'in_app' => [
                        [
                            'product_id' => 'com.murihspace.coins.275.ios',
                            'transaction_id' => 'txn_old_111',
                            'purchase_date_ms' => '1700000000000',
                        ],
                        [
                            'product_id' => 'com.murihspace.coins.275.ios',
                            'transaction_id' => 'txn_target_222',
                            'purchase_date_ms' => '1700000500000',
                        ],
                        [
                            'product_id' => 'com.murihspace.coins.275.ios',
                            'transaction_id' => 'txn_newest_333',
                            'purchase_date_ms' => '1700001000000',
                        ],
                    ],
                ],
            ]),
        ]);

        $verifier = new \App\Services\NativeStore\AppleStoreVerifier();
        $result = $verifier->verify(
            productId: 'com.murihspace.coins.275.ios',
            token: base64_encode('valid_simulated_receipt_data_long_enough_string'),
            expectedTransactionId: 'txn_target_222'
        );

        $this->assertTrue($result->valid);
        $this->assertSame('txn_target_222', $result->transactionId);
    }
}
