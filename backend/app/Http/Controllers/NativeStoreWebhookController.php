<?php

namespace App\Http\Controllers;

use App\Models\NativeStorePurchase;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * App Store / Google Play server notifications (webhooks).
 *
 * These are informational first: refund/revoke events mark matching native
 * purchases as revoked so admins can reconcile. Coins are NOT auto-deducted
 * — reversing customer-purchased inventory requires manual care.
 */
class NativeStoreWebhookController extends Controller
{
    public function apple(Request $request): JsonResponse
    {
        $expectedToken = config('payments.stores.apple.webhook_token');
        if ($expectedToken) {
            $token = $request->query('token') ?: $request->header('X-Webhook-Token');
            if (! $token || ! hash_equals((string) $expectedToken, (string) $token)) {
                return response()->json(['error' => 'Unauthorized webhook.'], 401);
            }
        }

        $signedPayload = is_string($request->input('signedPayload')) ? $request->input('signedPayload') : null;

        if (! $signedPayload) {
            return response()->json(['error' => 'Missing signedPayload'], 400);
        }

        try {
            $payload = $this->decodeJwsPayload($signedPayload);
            $type = $payload['notificationType'] ?? null;

            if (in_array($type, ['REFUND', 'REVOKE'], true)) {
                $info = $payload['data']['signedTransactionInfo'] ?? null;
                $txn = $info ? $this->decodeJwsPayload($info) : [];

                $transactionId = $txn['transactionId'] ?? null;
                $originalTransactionId = $txn['originalTransactionId'] ?? null;

                $updated = 0;
                if ($transactionId || $originalTransactionId) {
                    $updated = NativeStorePurchase::query()
                        ->where('store', 'apple')
                        ->where(function ($q) use ($transactionId, $originalTransactionId) {
                            if ($transactionId) {
                                $q->orWhere('store_transaction_id', $transactionId);
                            }
                            if ($originalTransactionId) {
                                $q->orWhere('store_order_id', $originalTransactionId);
                            }
                        })
                        ->where('status', '!=', 'revoked')
                        ->update(['status' => 'revoked']);
                }

                Log::info('Apple store refund notification processed', [
                    'notification_type' => $type,
                    'matched' => $updated,
                ]);
            }
        } catch (\Throwable $e) {
            Log::warning('Malformed Apple store notification', ['error' => $e->getMessage()]);
        }

        return response()->json([], 200);
    }

    public function google(Request $request): JsonResponse
    {
        $expectedToken = config('payments.stores.google.webhook_token');
        if ($expectedToken) {
            $token = $request->query('token') ?: $request->header('X-Webhook-Token');
            if (! $token || ! hash_equals((string) $expectedToken, (string) $token)) {
                return response()->json(['error' => 'Unauthorized webhook.'], 401);
            }
        }

        $data = $request->input('message.data');

        if (! is_string($data) || $data === '') {
            return response()->json(['error' => 'Missing message'], 400);
        }

        try {
            $decoded = json_decode((string) base64_decode($data, true), true, 512, JSON_THROW_ON_ERROR);
        } catch (\Throwable $e) {
            Log::warning('Malformed Google Play RTDN payload', ['error' => $e->getMessage()]);

            return response()->json([], 200);
        }

        if (isset($decoded['testNotification'])) {
            return response()->json([], 200);
        }

        $oneTime = $decoded['oneTimeProductNotification'] ?? null;

        if (is_array($oneTime)) {
            $notificationType = (int) ($oneTime['notificationType'] ?? -1);
            $purchaseToken = $oneTime['purchaseToken'] ?? null;

            if (($notificationType === 3 || $notificationType === 4) && is_string($purchaseToken)) {
                $updated = NativeStorePurchase::query()
                    ->where('store', 'google')
                    ->where('store_transaction_id', $purchaseToken)
                    ->where('status', '!=', 'revoked')
                    ->update(['status' => 'revoked']);

                Log::info('Google Play refund notification processed', [
                    'notification_type' => $notificationType,
                    'matched' => $updated,
                ]);
            }
        }

        return response()->json([], 200);
    }

    private function decodeJwsPayload(string $jws): array
    {
        $parts = explode('.', $jws);

        if (count($parts) < 3) {
            return [];
        }

        return json_decode($this->base64UrlDecode($parts[1]), true) ?? [];
    }

    private function base64UrlDecode(string $data): string
    {
        $remainder = strlen($data) % 4;

        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        return base64_decode(strtr($data, '-_', '+/'), true) ?: '';
    }
}