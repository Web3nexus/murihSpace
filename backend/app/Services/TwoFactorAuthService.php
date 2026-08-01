<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;

class TwoFactorAuthService
{
    public function generateSecret(): string
    {
        $random = random_bytes(20);
        return $this->base32Encode($random);
    }

    public function generateRecoveryCodes(): array
    {
        $codes = [];
        for ($i = 0; $i < 8; $i++) {
            $codes[] = strtoupper(
                implode('-', [
                    substr(bin2hex(random_bytes(3)), 0, 4),
                    substr(bin2hex(random_bytes(3)), 0, 4),
                    substr(bin2hex(random_bytes(3)), 0, 4),
                ])
            );
        }
        return $codes;
    }

    public function getProvisionUrl(string $secret, string $email, string $issuer = 'MurihSpace'): string
    {
        $encodedSecret = rawurlencode($secret);
        $encodedEmail = rawurlencode($email);
        $encodedIssuer = rawurlencode($issuer);
        return "otpauth://totp/{$encodedIssuer}:{$encodedEmail}?secret={$encodedSecret}&issuer={$encodedIssuer}&algorithm=SHA1&digits=6&period=30";
    }

    public function verify(string $secret, string $code): bool
    {
        $code = trim($code);
        if (!preg_match('/^\d{6}$/', $code)) {
            return false;
        }

        $timestamp = time();
        for ($i = -1; $i <= 1; $i++) {
            $calculated = $this->generateOTP($secret, $timestamp + ($i * 30));
            if (hash_equals($calculated, $code)) {
                return true;
            }
        }
        return false;
    }

    public function encryptSecret(string $secret): string
    {
        return Crypt::encryptString($secret);
    }

    public function decryptSecret(string $encrypted): string
    {
        return Crypt::decryptString($encrypted);
    }

    private function generateOTP(string $secret, int $timestamp): string
    {
        $counter = pack('N*', 0) . pack('N*', (int) floor($timestamp / 30));
        $secretBin = $this->base32Decode($secret);
        $hash = hash_hmac('sha1', $counter, $secretBin, true);
        $offset = ord(substr($hash, -1)) & 0x0F;
        $value = (
            ((ord(substr($hash, $offset)) & 0x7F) << 24) |
            ((ord(substr($hash, $offset + 1)) & 0xFF) << 16) |
            ((ord(substr($hash, $offset + 2)) & 0xFF) << 8) |
            (ord(substr($hash, $offset + 3)) & 0xFF)
        ) % 1000000;
        return str_pad((string) $value, 6, '0', STR_PAD_LEFT);
    }

    private function base32Encode(string $data): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $binary = '';
        foreach (str_split($data) as $char) {
            $binary .= str_pad(decbin(ord($char)), 8, '0', STR_PAD_LEFT);
        }
        $output = '';
        foreach (str_split($binary, 5) as $chunk) {
            $output .= $alphabet[bindec(str_pad($chunk, 5, '0', STR_PAD_RIGHT))];
        }
        return $output;
    }

    private function base32Decode(string $data): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $data = strtoupper($data);
        $binary = '';
        foreach (str_split($data) as $char) {
            $pos = strpos($alphabet, $char);
            if ($pos === false) continue;
            $binary .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        $output = '';
        foreach (str_split($binary, 8) as $chunk) {
            if (strlen($chunk) < 8) break;
            $output .= chr(bindec($chunk));
        }
        return $output;
    }
}
