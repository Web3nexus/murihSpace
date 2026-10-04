<?php

namespace App\Events;

use App\Models\MeetingParticipant;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast on the private `meeting.{code}` channel.
 *
 * `ShouldBroadcastNow` (rather than queued) is deliberate: presence must not
 * lag behind the join itself, or a participant appears to have joined a second
 * or two late — or not at all when the queue worker is down.
 */
class MeetingParticipantLeft implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public string $code,
        public MeetingParticipant $participant,
        public array $participants,
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('meeting.'.$this->code)];
    }

    public function broadcastAs(): string
    {
        return 'MeetingParticipantLeft';
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
