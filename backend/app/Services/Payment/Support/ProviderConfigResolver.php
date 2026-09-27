<?php

namespace App\Services\Payment\Support;

use App\Models\PaymentProvider;

/**
 * Resolves a payment provider's effective configuration.
 *
 * Credentials can arrive from two places:
 *
 *   1. Environment variables, via config/payments.php. This is the classic path.
 *   2. The admin UI (Admin Payment Providers), which persists keys into the
 *      `payment_providers.config` JSON column.
 *
 * The provider classes previously read config() exclusively, so anything typed
 * into the admin UI was stored and reported as "Configured" but never actually
 * used — the provider went on to throw "secret key is missing" at checkout.
 * This resolver overlays the admin values on top of the env defaults so both
 * sources work, with the admin UI taking precedence (it is the operational
 * control surface).
 *
 * Empty strings are ignored so that a blank field in the admin form never
 * blanks out a working environment variable.
 */
final class ProviderConfigResolver
{
    /**
     * Admin form field names that differ from the config() key a provider
     * actually reads. The admin controller persists a fixed set of field names
     * (`webhook_secret`) regardless of provider, but Flutterwave's config key
     * is `webhook_secret_hash`.
     *
     * @var array<string, array<string, string>>
     */
    private const ALIASES = [
        'flutterwave' => [
            'webhook_secret' => 'webhook_secret_hash',
        ],
        'paddle' => [
            'webhook_secret' => 'webhook_secret',
        ],
        // Stripe is not routed through ProviderRouter (it is the legacy order
        // checkout path) and reads config/stripe.php, whose keys are `key` and
        // `secret`, while the admin form persists `secret_key`/`public_key`.
        'stripe' => [
            'secret_key' => 'secret',
            'public_key' => 'key',
        ],
    ];

    /**
     * Effective config for a provider: env defaults overlaid with admin values.
     *
     * Deliberately not memoized. A static cache would survive across requests
     * in long-lived workers (queue:work, Octane), so a rotated credential would
     * not take effect until the process restarted. This is one indexed lookup
     * per provider construction, which is a few per payment request.
     *
     * @return array<string, mixed>
     */
    public static function resolve(string $code): array
    {
        $code = strtolower($code);
        $cfg = (array) config("payments.providers.{$code}", []);

        $row = self::adminRecord($code);

        if ($row !== null) {
            // The admin toggle and environment selector are authoritative for
            // the live routing decision, so surface them under the keys the
            // provider classes read.
            $cfg['enabled'] = (bool) $row->is_enabled;
            if (! empty($row->environment)) {
                $cfg['environment'] = $row->environment;
            }

            $stored = is_array($row->config) ? $row->config : [];
            foreach (self::ALIASES[$code] ?? [] as $field => $target) {
                if (! empty($stored[$field])) {
                    $stored[$target] = $stored[$field];
                }
            }

            foreach ($stored as $key => $value) {
                if ($value === null || $value === '' || $value === []) {
                    continue;
                }
                $cfg[$key] = $value;
            }
        }

        return $cfg;
    }

    /**
     * The admin-managed provider row, or null when there is none / the table is
     * not reachable (fresh install, mid-migration, seeder, console context).
     */
    private static function adminRecord(string $code): ?PaymentProvider
    {
        try {
            return PaymentProvider::where('code', $code)->first();
        } catch (\Throwable) {
            // Never let a credential lookup take down a payment request.
            return null;
        }
    }
}
