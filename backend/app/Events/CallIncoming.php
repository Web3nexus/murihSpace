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

class CallIncoming implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public Call $call
    ) {
        $this->call->loadMissing(['caller:id,name,username,avatar', 'recipient:id,name,username,avatar']);
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('user.' . $this->call->recipient_id),
            new PrivateChannel('App.Models.User.' . $this->call->recipient_id),
        ];
    }

    public function broadcastAs(): string
    {
        return 'call.incoming';
    }

    public function broadcastWith(): array
    {
        $caller = $this->call->caller;

        $host = (string) config('livekit.host', 'https://live-staging.murihspace.com');
        $host = rtrim($host, '/');
        if (str_starts_with($host, 'https://')) {
            $livekitHost = 'wss://' . substr($host, 8);
        } elseif (str_starts_with($host, 'http://')) {
            $livekitHost = 'ws://' . substr($host, 7);
        } else {
            $livekitHost = $host;
        }

        // Pre-generate a LiveKit token for the callee so that when they tap Accept,
        // they can connect to the room immediately without an extra round-trip.
        $recipientToken = null;
        try {
            $service = app(LiveKitService::class);
            $recipient = $this->call->recipient;
            $recipientToken = $service->generateToken(
                identity: 'user_' . $this->call->recipient_id,
                roomName: $this->call->room_name,
                metadata: json_encode([
                    'user_id' => $this->call->recipient_id,
                    'name'    => $recipient?->name ?? 'Callee',
                    'call_id' => $this->call->id,
                    'type'    => $this->call->type,
                ]),
                canPublish: true,
                canSubscribe: true,
                name: $recipient?->name ?? 'Callee',
            );
        } catch (\Throwable $e) {
            Log::warning('[CallIncoming] Could not generate recipient LiveKit token: ' . $e->getMessage());
        }

        return [
            'id'            => $this->call->id,
            'caller_id'     => $this->call->caller_id,
            'recipient_id'  => $this->call->recipient_id,
            'conversation_id' => $this->call->conversation_id,
            'type'          => $this->call->type,
            'status'        => $this->call->status,
            'room_name'     => $this->call->room_name,
            'livekit_host'  => $livekitHost,
            'livekit_token' => $recipientToken,  // <-- pre-generated for callee
            'created_at'    => $this->call->created_at?->toIso8601String(),
            'caller' => $caller ? [
                'id'         => $caller->id,
                'name'       => $caller->name,
                'username'   => $caller->username,
                'avatar'     => $caller->avatar,
                'avatar_url' => $caller->avatar_url ?? $caller->avatar,
            ] : null,
        ];
    }
}
