<?php

namespace App\Jobs;

use App\Models\AdminSetting;
use App\Models\CreatorQualificationEvent;
use App\Notifications\CreatorQualificationNotification;
use App\Services\NotificationService;
use App\Services\SocialAccountService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class CheckCreatorQualification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(
        public readonly int $eventId,
    ) {}

    public function handle(
        SocialAccountService $socialService,
        NotificationService $notifications,
    ): void {
        $event = CreatorQualificationEvent::with(['user', 'snapshot'])->find($this->eventId);

        if (! $event) {
            Log::warning('CheckCreatorQualification: event not found', ['event_id' => $this->eventId]);
            return;
        }

        // Already processed — skip (but allow re-notified reminder cycle)
        if (! $event->isPending() && $event->status !== 'notified') {
            return;
        }

        // Expired by time
        if ($event->isExpired()) {
            $event->update(['status' => 'expired']);
            return;
        }

        $user = $event->user;

        // Recheck threshold at fire time to prevent false positives from spikes
        if (! $socialService->checkQualificationThreshold($user)) {
            Log::info('CheckCreatorQualification: threshold no longer met', [
                'user_id'  => $user->id,
                'event_id' => $event->id,
            ]);
            $event->update(['status' => 'expired']);
            return;
        }

        // Mark notified
        $event->update([
            'status'      => 'notified',
            'notified_at' => now(),
        ]);

        // In-app database notification
        $user->notify(new CreatorQualificationNotification($event));

        // Email notification
        $emailEnabled = (bool) AdminSetting::get('creator_qualification.email_enabled', true);
        if ($emailEnabled) {
            $subject = AdminSetting::get(
                'creator_qualification.email_subject',
                'You may qualify as a MurihSpace Creator!'
            );
            $content = AdminSetting::get(
                'creator_qualification.email_content',
                'Congratulations! Your combined social following has reached our creator threshold. Click below to start your creator application on MurihSpace.'
            );

            $notifications->actionEmail(
                $user,
                $subject,
                $content,
                'Apply as Creator',
                NotificationService::link('/upgrade/creator'),
                'You are receiving this because your accounts are connected to MurihSpace.',
                'creator_qualification',
            );
        }

        Log::info('CheckCreatorQualification: user notified', [
            'user_id'  => $user->id,
            'event_id' => $event->id,
        ]);

        // Schedule at most one reminder. Track in metadata to prevent infinite chains
        // (the job would otherwise reschedule itself on every cycle while status is 'notified').
        $reminderEnabled = (bool) AdminSetting::get('creator_qualification.reminder_enabled', false);
        $metadata = $event->metadata ?? [];

        if ($reminderEnabled && empty($metadata['reminder_scheduled'])) {
            $event->update(['metadata' => array_merge($metadata, ['reminder_scheduled' => true])]);
            $reminderHours = (int) AdminSetting::get('creator_qualification.reminder_delay_hours', 48);
            self::dispatch($this->eventId)->delay(now()->addHours($reminderHours));
        }
    }
}
