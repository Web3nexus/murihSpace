<?php

namespace App\Services;

use App\Jobs\SendSupportEvent;
use App\Models\User;
use Illuminate\Support\Facades\Config;

/**
 * Thin wrapper around the queued support-event webhook. Keeps call sites short
 * while allowing event sync to be toggled centrally.
 */
class SupportEventPublisher
{
    public static function push(
        string $eventKey,
        array $payload = [],
        ?string $actorType = null,
        ?string $actorReference = null,
        ?User $user = null,
        ?int $occurredAt = null,
        ?string $eventId = null,
    ): void {
        if (! Config::boolean('services.support_events.enabled', true)) {
            return;
        }

        SendSupportEvent::dispatch(
            $eventKey,
            $payload,
            $actorType,
            $actorReference,
            $user?->email,
            $occurredAt ?? now()->getTimestamp(),
            $eventId,
        );
    }
}
