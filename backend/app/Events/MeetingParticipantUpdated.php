<?php

namespace App\Events;

use App\Models\MeetingParticipant;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * A participant's mic/camera state changed, or a host applied a moderation
 * action (mute / restrict / remove / role change). Carries the full roster so
 * a client that missed an earlier event still converges on the truth.
 */
class MeetingParticipantUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $code,
        public MeetingParticipant $participant,
        public array $participants,
        public string $reason = 'state',
        public ?array $target = null,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('meeting.'.$this->code)];
    }

    public function broadcastAs(): string
    {
        return 'MeetingParticipantUpdated';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'participant' => $this->participant->toPresencePayload(),
            'participants' => $this->participants,
            'reason' => $this->reason,
            'target' => $this->target,
        ];
    }
}
