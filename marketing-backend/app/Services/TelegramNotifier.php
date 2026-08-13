<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * Minimal Telegram bot client for critical staff escalations. Mirrors the
 * main backend's admin-alert Telegram routing without a third-party channel
 * dependency. Sends are best-effort and never throw.
 */
class TelegramNotifier
{
    public function send(string $token, string $chatId, string $title, string $message, ?string $actionUrl = null): bool
    {
        if ($token === '' || $chatId === '') {
            return false;
        }

        $text = '<b>'.htmlspecialchars($title)."</b>\n\n".htmlspecialchars($message);
        if ($actionUrl !== null) {
            $text .= "\n\n".htmlspecialchars($actionUrl);
        }

        try {
            $response = Http::timeout(8)
                ->post("https://api.telegram.org/bot{$token}/sendMessage", [
                    'chat_id' => $chatId,
                    'text' => $text,
                    'parse_mode' => 'HTML',
                    'disable_web_page_preview' => true,
                ]);
        } catch (ConnectionException) {
            return false;
        }

        return $response->successful();
    }
}
