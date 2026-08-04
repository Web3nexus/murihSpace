<?php

namespace App\Events;

use App\Models\Gift;
use App\Models\User;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class GiftSentEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public User $sender,
        public User $recipient,
        public Gift $gift,
        public int $amount,
        public string $currency,
        public ?string $sessionId = null,
        public ?string $animationType = 'standard',
        public bool $isAnonymous = false,
        public ?string $senderDisplayName = null,
    ) {}

    public function broadcastOn(): array
    {
        if ($this->sessionId) {
            return [
                new Channel('live-session.' . $this->sessionId),
            ];
        }

        return [
            new Channel('creator-gifts.' . $this->recipient->id),
        ];
    }

    public function broadcastWith(): array
    {
        $sender = $this->isAnonymous
            ? ['display_name' => $this->senderDisplayName ?? 'Someone']
            : [
                'id'       => $this->sender->id,
                'name'     => $this->sender->name,
                'username' => $this->sender->username,
                'avatar'   => $this->sender->avatar_url ?? $this->sender->avatar,
            ];

        return [
            'sender' => $sender,
            'recipient' => [
                'id'       => $this->recipient->id,
                'name'     => $this->recipient->name,
                'username' => $this->recipient->username,
            ],
            'gift' => [
                'id'             => $this->gift->id,
                'name'           => $this->gift->name,
                'icon'           => $this->gift->icon,
                'animation_type' => $this->animationType,
            ],
            'amount'       => $this->amount,
            'currency'     => $this->currency,
            'is_anonymous' => $this->isAnonymous,
            'session_id'   => $this->sessionId,
            'sent_at'      => now()->toIso8601String(),
        ];
    }
}
