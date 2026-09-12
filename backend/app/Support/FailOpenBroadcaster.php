<?php

namespace App\Support;

use Illuminate\Broadcasting\Broadcasters\Broadcaster;
use Throwable;

/**
 * Decorates a real broadcaster so a failing broadcast (e.g. the Reverb/Pusher
 * HTTP API being unreachable) never bubbles up and breaks the request.
 * Deliveries are swallowed, reported to the error log, and will resume once
 * the broadcasting server comes back online.
 */
class FailOpenBroadcaster extends Broadcaster
{
    public function __construct(protected Broadcaster $inner)
    {
    }

    public function broadcast(array $channels, $event, array $payload = [])
    {
        try {
            $this->inner->broadcast($channels, $event, $payload);
        } catch (Throwable $e) {
            report($e);
        }
    }

    public function auth($request)
    {
        return $this->inner->auth($request);
    }

    public function validAuthenticationResponse($request, $result)
    {
        return $this->inner->validAuthenticationResponse($request, $result);
    }

    public function channel($channel, $callback, $options = [])
    {
        $this->inner->channel($channel, $callback, $options);

        return $this;
    }
}