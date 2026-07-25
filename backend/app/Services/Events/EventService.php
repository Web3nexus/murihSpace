<?php

namespace App\Services\Events;

use App\Models\Event;
use App\Models\EventRegistration;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class EventService
{
    public function create(array $data, User $creator): Event
    {
        $data['creator_id'] = $creator->id;
        $data['slug'] = Str::slug($data['title']).'-'.Str::random(6);

        return Event::create($data);
    }

    public function register(Event $event, User $user): EventRegistration
    {
        if (! $event->isRegistrationOpen()) {
            throw new RuntimeException('Registration is not open for this event.');
        }

        return DB::transaction(function () use ($event, $user) {
            $existing = EventRegistration::where('event_id', $event->id)
                ->where('user_id', $user->id)
                ->first();

            if ($existing) {
                if ($existing->status === 'cancelled') {
                    $existing->update([
                        'status' => 'registered',
                        'registered_at' => now(),
                        'cancelled_at' => null,
                    ]);

                    return $existing;
                }
                throw new RuntimeException('You are already registered for this event.');
            }

            return EventRegistration::create([
                'event_id' => $event->id,
                'user_id' => $user->id,
                'status' => 'registered',
                'registered_at' => now(),
            ]);
        });
    }

    public function cancelRegistration(Event $event, User $user): void
    {
        $registration = EventRegistration::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->where('status', 'registered')
            ->firstOrFail();

        $registration->update([
            'status' => 'cancelled',
            'cancelled_at' => now(),
        ]);
    }

    public function checkIn(Event $event, User $user): EventRegistration
    {
        $registration = EventRegistration::where('event_id', $event->id)
            ->where('user_id', $user->id)
            ->where('status', 'registered')
            ->firstOrFail();

        $registration->update([
            'status' => 'attended',
            'attended_at' => now(),
        ]);

        return $registration;
    }

    public function getUpcomingForUser(User $user)
    {
        return EventRegistration::where('user_id', $user->id)
            ->where('status', 'registered')
            ->whereHas('event', fn ($q) => $q->published()->upcoming())
            ->with('event.community')
            ->latest('registered_at')
            ->get();
    }
}
