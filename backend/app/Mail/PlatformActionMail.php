<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PlatformActionMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $recipientName,
        public string $title,
        public string $bodyHtml,
        public ?string $actionLabel = null,
        public ?string $actionUrl = null,
        public ?string $footnote = null,
        public ?array $details = null,
        public ?string $supportEmail = null,
        public ?string $logoUrl = null,
        public ?string $subjectText = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->subjectText ?? trim(html_entity_decode(strip_tags($this->title), ENT_QUOTES | ENT_HTML5, 'UTF-8')),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.layout',
            with: [
                'name' => $this->recipientName,
                'title' => $this->title,
                'body' => $this->bodyHtml,
                'bodyHtml' => $this->bodyHtml,
                'actionLabel' => $this->actionLabel,
                'actionUrl' => $this->actionUrl,
                'footnote' => $this->footnote,
                'details' => $this->details,
                'supportEmail' => $this->supportEmail,
                'logoUrl' => $this->logoUrl,
            ],
        );
    }
}
