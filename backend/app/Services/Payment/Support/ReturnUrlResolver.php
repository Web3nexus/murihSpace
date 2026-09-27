<?php

namespace App\Services\Payment\Support;

/**
 * Resolves the URL a customer is sent back to after a payment.
 *
 * Providers are handed a return/redirect URL on checkout. It used to be passed
 * straight through from the client, but no client in this codebase ever sends
 * one, so every provider received null and the customer was stranded on a
 * provider-hosted page after paying. The fallback below means a payment always
 * has somewhere to send the customer back to.
 *
 * Shared by the wallet/deposit flow (PaymentService) and the digital-product
 * checkout flow (CheckoutController) so there is one definition of the
 * precedence rules and one place that knows the {reference} placeholder.
 */
final class ReturnUrlResolver
{
    public const REFERENCE_PLACEHOLDER = '{reference}';

    /**
     * Precedence: explicit client value, then PAYMENT_RETURN_URL, then a
     * wallet page derived from FRONTEND_URL.
     *
     * @return string|null Null only when nothing at all is configured, which
     *                     only happens with an empty FRONTEND_URL.
     */
    public static function resolve(?string $clientUrl, string $reference): ?string
    {
        $candidate = trim((string) $clientUrl);

        if ($candidate === '') {
            $candidate = trim((string) config('payments.return_url'));
        }

        if ($candidate === '') {
            // Already a complete URL (FRONTEND_URL + /wallet?payment=return),
            // not a base to append to.
            $candidate = (string) config('payments.return_url_fallback', '');
        }

        if ($candidate === '') {
            return null;
        }

        return str_replace(
            self::REFERENCE_PLACEHOLDER,
            rawurlencode($reference),
            $candidate,
        );
    }
}
