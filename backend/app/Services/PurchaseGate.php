<?php

namespace App\Services;

use App\Models\AdminSetting;
use Illuminate\Http\Request;

/**
 * Gates in-app purchase (money-in) flows so the web dashboard can be locked
 * to "app only" distribution (Apple App Store / Google Play store policy) while
 * the native apps keep purchasing.
 *
 * Clients identify themselves via the `X-Client-Platform` header: the native
 * app sends `app`; the web dashboard sends `web`. A request that omits the
 * header is treated like web (conservative — only explicit native clients pass).
 */
class PurchaseGate
{
    public static function webPurchasesEnabled(): bool
    {
        return (bool) AdminSetting::get('web_purchases_enabled', true);
    }

    /**
     * Whether the given request should be rejected because web purchases are
     * disabled but the request did not come from the native app.
     */
    public function blocksWebPurchase(Request $request): bool
    {
        if (self::webPurchasesEnabled()) {
            return false;
        }

        $client = strtolower((string) $request->header('X-Client-Platform', ''));

        return ! in_array($client, ['app', 'ios', 'android'], true);
    }

    /**
     * True when the request is considered to come from the native app.
     */
    public function isNativeApp(Request $request): bool
    {
        return in_array(strtolower((string) $request->header('X-Client-Platform', '')), ['app', 'ios', 'android'], true);
    }
}