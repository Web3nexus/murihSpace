<?php

namespace App\Services\LiveKit;

/**
 * Decides whether the server may record or transcode a LiveKit room.
 *
 * Encrypted rooms (LiveKit E2EE) carry media the server cannot decrypt, so any
 * recording or HLS conversion would produce unplayable output. Such rooms are
 * skipped with a stated reason instead of failing the request or the job.
 */
final class RoomRecordingPolicy
{
    public const SKIP_REASON_E2EE = 'e2ee_room';

    public const SKIP_MESSAGE_E2EE = 'Recording is unavailable for end-to-end encrypted rooms: the server does not hold the room key and cannot decrypt the media.';

    /**
     * Returns null when the room may be recorded, otherwise a machine-readable reason.
     */
    public static function skipReason(bool $e2ee): ?string
    {
        return $e2ee ? self::SKIP_REASON_E2EE : null;
    }

    /**
     * Human-readable message matching {@see skipReason()}.
     */
    public static function skipMessage(?string $reason): ?string
    {
        return $reason === self::SKIP_REASON_E2EE ? self::SKIP_MESSAGE_E2EE : null;
    }
}
