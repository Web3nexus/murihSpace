<?php

namespace App\Services;

use App\Mail\PlatformActionMail;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    /**
     * Send a branded action email to a user.
     */
    public function actionEmail(
        ?User $user,
        string $title,
        string $bodyHtml,
        ?string $actionLabel = null,
        ?string $actionUrl = null,
        ?string $footnote = null,
    ): void {
        if (! $user) {
            return;
        }

        $email = $user->email;
        if (! $email || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        Mail::to($user)->send(new PlatformActionMail(
            recipientName: $user->name ?: 'there',
            title: $title,
            bodyHtml: $bodyHtml,
            actionLabel: $actionLabel,
            actionUrl: $actionUrl,
            footnote: $footnote,
        ));
    }

    /**
     * Build a relative link into an absolute frontend URL.
     */
    public static function link(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/'.ltrim($path, '/');
    }
}
