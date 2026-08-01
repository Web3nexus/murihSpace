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
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->title,
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
                'actionLabel' => $this->actionLabel,
                'actionUrl' => $this->actionUrl,
                'footnote' => $this->footnote,
            ],
        );
    }
}
