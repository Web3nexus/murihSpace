<?php

namespace Tests\Concerns;

/**
 * Builds ES256 JWS signedPayloads the way Apple signs App Store Server
 * Notifications, using the test CA in tests/Fixtures/apple. Tests point
 * payments.stores.apple.root_certificate at the test root, never Apple's.
 */
trait SignsAppleNotifications
{
    /**
     * Pins the test root that issued the apple-chain-* fixtures. Those carry the Apple certificate-type
     * OIDs the verifier requires. The older test-* chain has no such OIDs and is rejected under this root.
     */
    protected function useAppleTestRoot(): void
    {
        config(['payments.stores.apple.root_certificate' => base_path('tests/Fixtures/apple/apple-chain-root.pem')]);
    }

    /**
     * @param  list<string>  $certFiles  PEM files for the x5c chain, leaf first
     * @param  array<string, mixed>  $headerOverrides
     */
    protected function appleSignedPayload(array $payload, string $keyFile, array $certFiles, array $headerOverrides = []): string
    {
        $header = array_merge([
            'alg' => 'ES256',
            'x5c' => array_map(fn (string $file) => $this->pemBody($file), $certFiles),
        ], $headerOverrides);

        $signingInput = $this->base64UrlEncode(json_encode($header)).'.'.$this->base64UrlEncode(json_encode($payload));

        openssl_sign($signingInput, $der, openssl_pkey_get_private(file_get_contents($keyFile)), OPENSSL_ALGO_SHA256);

        return $signingInput.'.'.$this->base64UrlEncode($this->derSignatureToRaw($der));
    }

    protected function appleFixture(string $name): string
    {
        return base_path('tests/Fixtures/apple/'.$name);
    }

    private function pemBody(string $file): string
    {
        return trim(preg_replace('/-----[A-Z ]+-----|\s+/', '', file_get_contents($file)));
    }

    private function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * Converts a DER ECDSA signature into raw R||S (32 bytes each) as JWS requires.
     */
    private function derSignatureToRaw(string $der): string
    {
        $offset = 2;
        $parts = [];

        for ($i = 0; $i < 2; $i++) {
            $length = ord($der[$offset + 1]);
            $value = ltrim(substr($der, $offset + 2, $length), "\x00");
            $parts[] = str_pad($value, 32, "\x00", STR_PAD_LEFT);
            $offset += 2 + $length;
        }

        return implode('', $parts);
    }
}
