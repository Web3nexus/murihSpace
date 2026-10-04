<?php

namespace App\Events;

use App\Models\LiveStreamParticipant;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast on the private `live-room.{id}` channel so the host, co-hosts and
 * moderators see attendance and moderation results reflected live.
 *
 * Deliberately NOT `live-stream.{id}`: that channel is public because
 * `LiveStreamEnded` must also reach signed-out guests watching a share link,
 * and viewer identities must not be exposed on a public channel.
 */
class LiveStreamParticipantPresence implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $streamId,
        public string $action,
        public LiveStreamParticipant $participant,
        /**
         * The changed participant's presence payload, not the whole roster.
         * Callers fetch the full roster from the participants endpoint.
         */
        public array $participantPayload,
        public array $meta = [],
    ) {}

    public function broadcastOn(): array
    {
        return [new PrivateChannel('live-room.'.$this->streamId)];
    }

    public function broadcastAs(): string
    {
        return 'LiveStreamParticipantPresence';
    }

    /**
     * @return array<string, mixed>
     */
    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'participant' => $this->participant->toPresencePayload(),
            'participant_payload' => $this->participantPayload,
        ] + $this->meta;
    }
}
