<?php

namespace App\Events;

use App\Models\Call;
use App\Services\LiveKitService;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CallAccepted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Call $call
    ) {
        $this->call->loadMissing(['caller:id,name,username,avatar']);
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('call.' . $this->call->room_name),
            // Notify caller on both channel formats (mobile + web)
            new PrivateChannel('user.' . $this->call->caller_id),
            new PrivateChannel('App.Models.User.' . $this->call->caller_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call.accepted';
    }

    public function broadcastWith(): array
    {
        $host = (string) config('livekit.host', 'https://live-staging.murihspace.com');
        $host = rtrim($host, '/');
        if (str_starts_with($host, 'https://')) {
            $livekitHost = 'wss://' . substr($host, 8);
        } elseif (str_starts_with($host, 'http://')) {
            $livekitHost = 'ws://' . substr($host, 7);
        } else {
            $livekitHost = $host;
        }

        // Generate a fresh LiveKit token for the CALLER so they can join the room
        // now that the call is confirmed accepted (original initiate token may have aged).
        $callerToken = null;
        try {
            $service = app(LiveKitService::class);
            $caller  = $this->call->caller;
            $callerToken = $service->generateToken(
                identity: 'user_' . $this->call->caller_id,
                roomName: $this->call->room_name,
                metadata: json_encode([
                    'user_id' => $this->call->caller_id,
                    'name'    => $caller?->name ?? 'Caller',
                    'call_id' => $this->call->id,
                    'type'    => $this->call->type,
                ]),
                canPublish: true,
                canSubscribe: true,
                name: $caller?->name ?? 'Caller',
            );
        } catch (\Throwable $e) {
            Log::warning('[CallAccepted] Could not generate caller LiveKit token: ' . $e->getMessage());
        }

        return [
            'id'            => $this->call->id,
            'status'        => $this->call->status,
            'type'          => $this->call->type,
            'room_name'     => $this->call->room_name,
            'caller_id'     => $this->call->caller_id,
            'recipient_id'  => $this->call->recipient_id,
            'livekit_host'  => $livekitHost,
            'livekit_token' => $callerToken,   // <-- fresh token for caller to join room
            'started_at'    => $this->call->started_at?->toIso8601String(),
        ];
    }
}
