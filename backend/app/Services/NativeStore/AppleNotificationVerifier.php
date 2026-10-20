<?php

namespace App\Services\NativeStore;

use App\Services\NativeStore\Exceptions\AppleNotificationVerificationException;

/**
 * Verifies an App Store Server Notification signedPayload (ES256 JWS).
 *
 * The x5c header chain must link leaf -> ... -> root, where the final
 * certificate is issued by the pinned Apple Root CA - G3 (config key
 * payments.stores.apple.root_certificate). Every certificate in the chain
 * must be within its validity period, and the JWS signature must verify
 * with the leaf certificate's public key.
 */
class AppleNotificationVerifier
{
    /** Certificate-type extensions Apple sets on its notification leaf and intermediate. */
    private const LEAF_OID = '1.2.840.113635.100.6.11.1';

    private const INTERMEDIATE_OID = '1.2.840.113635.100.6.2.1';

    /**
     * @return array<string, mixed> the decoded, verified payload
     *
     * @throws AppleNotificationVerificationException
     */
    public function verify(string $signedPayload): array
    {
        $parts = explode('.', $signedPayload);

        if (count($parts) !== 3) {
            throw $this->fail('Malformed JWS.');
        }

        [$encodedHeader, $encodedPayload, $encodedSignature] = $parts;

        $header = json_decode($this->base64UrlDecode($encodedHeader), true);

        if (! is_array($header) || ($header['alg'] ?? null) !== 'ES256') {
            throw $this->fail('Unsupported JWS algorithm.');
        }

        $x5c = $header['x5c'] ?? null;

        if (! is_array($x5c) || $x5c === []) {
            throw $this->fail('Missing x5c certificate chain.');
        }

        $chain = [];

        foreach ($x5c as $der) {
            if (! is_string($der) || ($pem = $this->derToPem($der)) === null) {
                throw $this->fail('Malformed x5c certificate.');
            }

            $chain[] = $pem;
        }

        $this->verifyChain($chain);

        $signature = $this->base64UrlDecodeRaw($encodedSignature);

        if ($signature === false || strlen($signature) !== 64) {
            throw $this->fail('Malformed JWS signature.');
        }

        $leafKey = openssl_pkey_get_public($chain[0]);

        if ($leafKey === false || openssl_verify(
            $encodedHeader.'.'.$encodedPayload,
            $this->rawSignatureToDer($signature),
            $leafKey,
            OPENSSL_ALGO_SHA256,
        ) !== 1) {
            throw $this->fail('Invalid JWS signature.');
        }

        $payload = json_decode($this->base64UrlDecode($encodedPayload), true);

        if (! is_array($payload)) {
            throw $this->fail('Malformed JWS payload.');
        }

        return $payload;
    }

    /**
     * @param  list<string>  $chain  PEM certificates, leaf first
     */
    private function verifyChain(array $chain): void
    {
        $root = $this->rootCertificate();

        // Apple signs each notification with one leaf and one intermediate. Other certificates under
        // the same root, such as developer-held Apple Pay certificates, must not pass as notification keys.
        if (count($chain) !== 2) {
            throw $this->fail('Certificate chain must be exactly a leaf and one intermediate.');
        }

        foreach ($chain as $index => $certificate) {
            $this->assertValidNow($certificate);

            $issuer = $chain[$index + 1] ?? $root;
            $issuerKey = openssl_pkey_get_public($issuer);

            if ($issuerKey === false || openssl_x509_verify($certificate, $issuerKey) !== 1) {
                throw $this->fail('Certificate chain does not terminate at the Apple root.');
            }
        }

        $leaf = openssl_x509_parse($chain[0]);
        $intermediate = openssl_x509_parse($chain[1]);

        if (! isset($leaf['extensions'][self::LEAF_OID])) {
            throw $this->fail('Leaf certificate is not an Apple notification certificate.');
        }

        if (! isset($intermediate['extensions'][self::INTERMEDIATE_OID])
            || ! str_contains((string) ($intermediate['extensions']['basicConstraints'] ?? ''), 'CA:TRUE')) {
            throw $this->fail('Intermediate certificate is not an Apple intermediate CA.');
        }

        $this->assertValidNow($root);
    }

    private function assertValidNow(string $certificate): void
    {
        $details = openssl_x509_parse($certificate);

        if ($details === false
            || time() < ($details['validFrom_time_t'] ?? PHP_INT_MAX)
            || time() > ($details['validTo_time_t'] ?? 0)) {
            throw $this->fail('Certificate is expired or not yet valid.');
        }
    }

    private function rootCertificate(): string
    {
        $path = (string) config('payments.stores.apple.root_certificate');
        $pem = is_file($path) ? file_get_contents($path) : false;

        if ($pem === false || openssl_x509_read($pem) === false) {
            throw $this->fail('Apple root certificate is not configured.');
        }

        return $pem;
    }

    private function derToPem(string $der): ?string
    {
        $pem = "-----BEGIN CERTIFICATE-----\n".chunk_split($der, 64, "\n")."-----END CERTIFICATE-----\n";

        return openssl_x509_read($pem) === false ? null : $pem;
    }

    /**
     * Converts a raw 64-byte ECDSA P-256 signature (R||S) into the DER form openssl_verify expects.
     */
    private function rawSignatureToDer(string $raw): string
    {
        $encodeInteger = function (string $bytes): string {
            $bytes = ltrim($bytes, "\x00") ?: "\x00";

            if (ord($bytes[0]) & 0x80) {
                $bytes = "\x00".$bytes;
            }

            return "\x02".chr(strlen($bytes)).$bytes;
        };

        $body = $encodeInteger(substr($raw, 0, 32)).$encodeInteger(substr($raw, 32, 32));

        return "\x30".chr(strlen($body)).$body;
    }

    private function base64UrlDecode(string $data): string
    {
        return $this->base64UrlDecodeRaw($data) ?: '';
    }

    private function base64UrlDecodeRaw(string $data): string|false
    {
        $remainder = strlen($data) % 4;

        if ($remainder) {
            $data .= str_repeat('=', 4 - $remainder);
        }

        return base64_decode(strtr($data, '-_', '+/'), true);
    }

    private function fail(string $message): AppleNotificationVerificationException
    {
        return new AppleNotificationVerificationException($message);
    }
}
