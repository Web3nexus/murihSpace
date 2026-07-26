<?php

namespace App\Mail;

use App\Models\EmailBroadcast;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BroadcastMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public EmailBroadcast $broadcast,
        public User $subscriber,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->broadcast->subject,
        );
    }

    public function content(): Content
    {
        return new Content(
            htmlString: $this->broadcast->content,
        );
    }
}
