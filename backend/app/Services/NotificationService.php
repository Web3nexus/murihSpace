<?php

namespace App\Services;

use App\Mail\PlatformActionMail;
use App\Models\EmailTemplate;
use App\Models\User;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    /**
     * Send a branded action email to a user.
     *
     * When a matching EmailTemplate (keyed by $template) exists and is active,
     * its subject and body override the defaults. The template body may use
     * placeholders such as {{name}}, {{currency}}, {{amount}}, {{reason}},
     * {{role}}, {{action_label}}, {{action_url}} and {{footnote}}.
     */
    public function actionEmail(
        ?User $user,
        string $title,
        string $bodyHtml,
        ?string $actionLabel = null,
        ?string $actionUrl = null,
        ?string $footnote = null,
        ?string $template = null,
        array $data = [],
    ): void {
        if (! $user) {
            return;
        }

        $email = $user->email;
        if (! $email || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return;
        }

        $override = $template ? EmailTemplate::for($template) : null;

        if ($override) {
            $title = $override->subject ?? $title;
            $bodyHtml = $override->body_html;
        }

        $data = array_merge([
            'name' => $user->name ?: 'there',
            'from_name' => '',
            'code' => '',
            'action_label' => $actionLabel,
            'action_url' => $actionUrl,
            'footnote' => $footnote,
        ], $data);

        $bodyHtml = $this->interpolate($bodyHtml, $data);
        $title = $this->interpolate($title, $data);

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
     * Replace {{placeholder}} tokens with values.
     */
    private function interpolate(string $html, array $data): string
    {
        $search = [];
        $replace = [];

        foreach ($data as $key => $value) {
            $search[] = '{{' . $key . '}}';
            $replace[] = $value === null ? '' : (string) $value;
        }

        return str_replace($search, $replace, $html);
    }

    /**
     * Build a relative link into an absolute frontend URL.
     */
    public static function link(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/'.ltrim($path, '/');
    }
}
