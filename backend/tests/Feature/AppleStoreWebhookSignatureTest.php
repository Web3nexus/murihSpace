<?php

namespace Tests\Feature;

use App\Models\CoinPack;
use App\Models\NativeStorePurchase;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\SignsAppleNotifications;
use Tests\TestCase;

class AppleStoreWebhookSignatureTest extends TestCase
{
    use RefreshDatabase;
    use SignsAppleNotifications;

    private NativeStorePurchase $purchase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->useAppleTestRoot();
        config(['payments.stores.apple.webhook_token' => 'apple-test-token']);

        $user = User::factory()->create(['email_verified_at' => now()]);
        $pack = CoinPack::create([
            'name' => 'Popular',
            'coins' => 250,
            'bonus_coins' => 25,
            'price' => 2500,
            'currency' => 'USD',
            'is_active' => true,
            'sort_order' => 1,
            'store_product_ios' => 'com.murihspace.coins.275.ios',
            'store_product_android' => 'com.murihspace.coins.275.android',
        ]);

        $this->purchase = NativeStorePurchase::create([
            'user_id' => $user->id,
            'coin_pack_id' => $pack->id,
            'store' => 'apple',
            'store_transaction_id' => 'txn_apple_sig_1',
            'product_id' => 'com.murihspace.coins.275',
            'amount_minor' => 2500,
            'currency' => 'USD',
            'credited_coins' => 275,
            'status' => 'completed',
            'internal_reference' => 'NSP-A-SIG00001',
        ]);
    }

    private function refundPayload(): array
    {
        return [
            'notificationType' => 'REFUND',
            'data' => ['signedTransactionInfo' => 'header.'.rtrim(strtr(base64_encode(json_encode([
                'transactionId' => 'txn_apple_sig_1',
            ])), '+/', '-_'), '=').'.sig'],
        ];
    }

    private function sendWebhook(string $signedPayload)
    {
        return $this->postJson('/api/v1/webhooks/apple-store', [
            'signedPayload' => $signedPayload,
        ], ['X-Webhook-Token' => 'apple-test-token']);
    }

    private function validSignedPayload(): string
    {
        return $this->appleSignedPayload(
            $this->refundPayload(),
            $this->appleFixture('apple-chain-leaf.key'),
            [$this->appleFixture('apple-chain-leaf.pem'), $this->appleFixture('apple-chain-intermediate.pem')],
        );
    }

    /** A signed payload whose chain is the given certificate files, all signed with the shared leaf key. */
    private function signedWithChain(array $certFiles): string
    {
        return $this->appleSignedPayload(
            $this->refundPayload(),
            $this->appleFixture('apple-chain-leaf.key'),
            array_map(fn (string $name) => $this->appleFixture($name), $certFiles),
        );
    }

    public function test_valid_chain_and_signature_are_accepted(): void
    {
        $this->sendWebhook($this->validSignedPayload())->assertStatus(200);

        $this->assertSame('revoked', $this->purchase->fresh()->status);
    }

    public function test_tampered_payload_is_rejected(): void
    {
        [$header, , $signature] = explode('.', $this->validSignedPayload());

        $tamperedPayload = rtrim(strtr(base64_encode(json_encode([
            'notificationType' => 'REFUND',
            'data' => ['signedTransactionInfo' => 'header.'.rtrim(strtr(base64_encode(json_encode([
                'transactionId' => 'txn_someone_else',
            ])), '+/', '-_'), '=').'.sig'],
        ])), '+/', '-_'), '=');

        $this->sendWebhook("{$header}.{$tamperedPayload}.{$signature}")->assertStatus(401);

        $this->assertSame('completed', $this->purchase->fresh()->status);
    }

    public function test_missing_x5c_is_rejected(): void
    {
        $signed = $this->appleSignedPayload(
            $this->refundPayload(),
            $this->appleFixture('test-leaf.key'),
            [$this->appleFixture('test-leaf.pem'), $this->appleFixture('test-intermediate-ca.pem')],
        );
        [$header, $payload, $signature] = explode('.', $signed);
        $headerWithoutChain = rtrim(strtr(base64_encode(json_encode(['alg' => 'ES256'])), '+/', '-_'), '=');

        $this->sendWebhook("{$headerWithoutChain}.{$payload}.{$signature}")->assertStatus(401);

        $this->assertSame('completed', $this->purchase->fresh()->status);
    }

    public function test_expired_leaf_is_rejected(): void
    {
        $signed = $this->signedWithChain(['apple-chain-expired-leaf.pem', 'apple-chain-intermediate.pem']);

        $this->sendWebhook($signed)->assertStatus(401);

        $this->assertSame('completed', $this->purchase->fresh()->status);
    }

    public function test_developer_chain_under_the_same_root_without_apple_oids_is_rejected(): void
    {
        // The older test-* chain is validly signed by its own root, but it carries no Apple certificate-type OIDs.
        config(['payments.stores.apple.root_certificate' => $this->appleFixture('test-root-ca.pem')]);
        $signed = $this->appleSignedPayload(
            $this->refundPayload(),
            $this->appleFixture('test-leaf.key'),
            [$this->appleFixture('test-leaf.pem'), $this->appleFixture('test-intermediate-ca.pem')],
        );

        $this->sendWebhook($signed)->assertStatus(401);

        $this->assertSame('completed', $this->purchase->fresh()->status);
    }

    public function test_leaf_without_the_notification_oid_is_rejected(): void
    {
        $this->sendWebhook($this->signedWithChain(['apple-chain-leaf-without-oid.pem', 'apple-chain-intermediate.pem']))
            ->assertStatus(401);

        $this->assertSame('completed', $this->purchase->fresh()->status);
    }

    public function test_intermediate_without_the_apple_oid_is_rejected(): void
    {
        $this->sendWebhook($this->signedWithChain(['apple-chain-leaf-under-plain-intermediate.pem', 'apple-chain-intermediate-without-oid.pem']))
            ->assertStatus(401);

        $this->assertSame('completed', $this->purchase->fresh()->status);
    }

    public function test_intermediate_that_is_not_a_ca_is_rejected(): void
    {
        $this->sendWebhook($this->signedWithChain(['apple-chain-leaf-under-not-ca.pem', 'apple-chain-intermediate-not-ca.pem']))
            ->assertStatus(401);

        $this->assertSame('completed', $this->purchase->fresh()->status);
    }

    public function test_chain_longer_than_leaf_and_intermediate_is_rejected(): void
    {
        $this->sendWebhook($this->signedWithChain([
            'apple-chain-leaf.pem',
            'apple-chain-intermediate.pem',
            'apple-chain-root.pem',
        ]))->assertStatus(401);

        $this->assertSame('completed', $this->purchase->fresh()->status);
    }

    public function test_chain_not_terminating_at_the_pinned_root_is_rejected(): void
    {
        // Trust anchor swapped for the intermediate: the chain no longer ends at the pinned root.
        config(['payments.stores.apple.root_certificate' => $this->appleFixture('test-intermediate-ca.pem')]);

        $this->sendWebhook($this->validSignedPayload())->assertStatus(401);

        $this->assertSame('completed', $this->purchase->fresh()->status);
    }
}
