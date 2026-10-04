<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown when somebody who was removed from a meeting or live stream tries to
 * rejoin it.
 *
 * Removal is sticky for the lifetime of the session: the presence row carries a
 * `removed_at` stamp and the join path refuses to resurrect it. Without a way to
 * say "no", the service had to either resurrect the participant (making the
 * moderator's removal inert) or fail silently, so this is an explicit gate the
 * controllers can turn into a 403.
 */
class RemovedFromSessionException extends RuntimeException
{
    public const CODE = 'REMOVED_FROM_SESSION';

    public function __construct(string $sessionType, string $sessionLabel)
    {
        parent::__construct(sprintf(
            'You were removed from this %s. A moderator declined to let you rejoin.',
            $sessionType
        ));

        $this->sessionType = $sessionType;
        $this->sessionLabel = $sessionLabel;
    }

    public readonly string $sessionType;

    public readonly string $sessionLabel;
}