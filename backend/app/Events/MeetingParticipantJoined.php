<?php

namespace App\Events;

use App\Models\MeetingParticipant;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast on the private `meeting.{code}` channel so every attendee sees a
 * join notification immediately, without waiting for their own roster refresh.
 *
 * Sent synchronously (`ShouldBroadcastNow`) because presence is time-critical:
 * a roster that lags by a queue tick shows the wrong participant count, which
 * is exactly what this feature set out to fix.
 */
class MeetingParticipantJoined implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $code,
        public MeetingParticipant $participant,
        public array $participants,
    ) {}

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [new PrivateChannel('meeting.'.$this->code)];
    }

    public function broadcastAs(): string
    {
        return 'MeetingParticipantJoined';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'participant' => $this->participant->toPresencePayload(),
            'participants' => $this->participants,
        ];
    }
}
