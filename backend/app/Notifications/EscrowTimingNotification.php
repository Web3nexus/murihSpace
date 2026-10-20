<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

/**
 * In-app notice about an escrow's release timing or hold. Stored on the database
 * channel only; the message text is fixed per kind and never includes contact details.
 */
class EscrowTimingNotification extends Notification
{
    public function __construct(
        public readonly string $kind,
        public readonly int $escrowId,
        public readonly string $message,
        public readonly ?string $releaseAt = null,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /** @return array<string, mixed> */
    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'escrow_timing',
            'kind' => $this->kind,
            'escrow_id' => $this->escrowId,
            'message' => $this->message,
            'release_at' => $this->releaseAt,
        ];
    }
}
