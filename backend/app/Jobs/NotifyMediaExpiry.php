<?php

namespace App\Jobs;

use App\Models\Media;
use App\Models\User;
use App\Notifications\MediaExpiryNotification;
use App\Services\MediaRetentionService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\DB;

/**
 * Notifies conversation participants that an attached chat media is about to
 * expire. Runs once per media object (guarded by the immutable retention log).
 */
class NotifyMediaExpiry implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public function __construct(
        public readonly int $mediaId,
    ) {}

    public function handle(MediaRetentionService $retention): void
    {
        $media = Media::find($this->mediaId);

        if (! $media || $media->isExpired()) {
            return;
        }

        $alreadyNotified = DB::table('media_retention_logs')
            ->where('media_id', $media->id)
            ->where('event', 'expiry_notified')
            ->exists();

        if ($alreadyNotified) {
            return;
        }

        $recipientIds = $media->messages()
            ->with('conversation.participants')
            ->get()
            ->flatMap(fn ($message) => $message->conversation?->participants ?? collect())
            ->pluck('user_id')
            ->unique()
            ->all();

        foreach (User::whereIn('id', $recipientIds)->get() as $user) {
            $user->notify(new MediaExpiryNotification($media));
        }

        $retention->log($media, null, 'expiry_notified', 'Expiry warning sent to conversation participants.');
    }
}
