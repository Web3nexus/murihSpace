<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\EventRegistration;
use App\Models\User;
use App\Services\Events\EventService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use RuntimeException;

class EventController extends Controller
{
    public function __construct(
        private readonly EventService $eventService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Event::published()->upcoming()->with('community:id,name,slug,logo_url', 'creator:id,name,username,avatar');

        if ($request->has('community_id')) {
            $query->byCommunity((int) $request->community_id);
        }

        $events = $query->latest('start_date')->paginate(20);

        return response()->json([
            'data' => $events->items(),
            'meta' => [
                'current_page' => $events->currentPage(),
                'last_page' => $events->lastPage(),
                'total' => $events->total(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $event = Event::published()
            ->with('community:id,name,slug,logo_url', 'creator:id,name,username,avatar')
            ->findOrFail($id);

        return response()->json([
            'data' => array_merge($event->toArray(), [
                'registration_count' => $event->registrationCount(),
                'is_full' => $event->isFull(),
                'is_registration_open' => $event->isRegistrationOpen(),
            ]),
        ]);
    }

    public function myEvents(Request $request): JsonResponse
    {
        $events = Event::where('creator_id', $request->user()->id)
            ->with('community:id,name,slug,logo_url')
            ->latest()
            ->paginate(20);

        return response()->json([
            'data' => $events->items(),
            'meta' => [
                'current_page' => $events->currentPage(),
                'last_page' => $events->lastPage(),
                'total' => $events->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('create', Event::class);

        $validated = $request->validate([
            'community_id' => ['required', 'exists:communities,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'event_type' => ['required', Rule::in(Event::EVENT_TYPES)],
            'start_date' => ['required', 'date', 'after:now'],
            'end_date' => ['required', 'date', 'after:start_date'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'location' => ['nullable', 'string', 'max:500'],
            'meeting_url' => ['nullable', 'string', 'url', 'max:2000'],
            'cover_url' => ['nullable', 'string', 'url', 'max:2000'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'registration_deadline' => ['nullable', 'date', 'before:start_date'],
        ]);

        $event = $this->eventService->create($validated, $request->user());

        return response()->json([
            'message' => 'Event created successfully.',
            'data' => $event,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $event = Event::findOrFail($id);

        Gate::authorize('update', $event);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:10000'],
            'event_type' => ['sometimes', Rule::in(Event::EVENT_TYPES)],
            'start_date' => ['sometimes', 'required', 'date'],
            'end_date' => ['sometimes', 'required', 'date', 'after:start_date'],
            'timezone' => ['nullable', 'string', 'max:64'],
            'location' => ['nullable', 'string', 'max:500'],
            'meeting_url' => ['nullable', 'string', 'url', 'max:2000'],
            'cover_url' => ['nullable', 'string', 'url', 'max:2000'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'registration_deadline' => ['nullable', 'date'],
        ]);

        $event->update($validated);

        return response()->json([
            'message' => 'Event updated successfully.',
            'data' => $event->fresh(),
        ]);
    }

    public function publish(Request $request, int $id): JsonResponse
    {
        $event = Event::findOrFail($id);

        Gate::authorize('publish', $event);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['draft', 'published', 'cancelled'])],
        ]);

        $event->update(['status' => $validated['status']]);

        return response()->json([
            'message' => "Event is now {$event->status}.",
            'data' => $event,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $event = Event::findOrFail($id);

        Gate::authorize('delete', $event);

        $event->delete();

        return response()->json(['message' => 'Event deleted successfully.']);
    }

    public function register(Request $request, int $eventId): JsonResponse
    {
        $event = Event::published()->findOrFail($eventId);

        try {
            $registration = $this->eventService->register($event, $request->user());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Successfully registered for the event.',
            'data' => $registration,
        ], 201);
    }

    public function cancelRegistration(Request $request, int $eventId): JsonResponse
    {
        $event = Event::findOrFail($eventId);

        try {
            $this->eventService->cancelRegistration($event, $request->user());
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'Registration cancelled successfully.']);
    }

    public function registrations(Request $request, int $eventId): JsonResponse
    {
        $event = Event::findOrFail($eventId);

        Gate::authorize('viewRegistrations', $event);

        $registrations = EventRegistration::where('event_id', $event->id)
            ->with('user:id,name,username,avatar')
            ->latest('registered_at')
            ->paginate(20);

        return response()->json([
            'data' => $registrations->items(),
            'meta' => [
                'current_page' => $registrations->currentPage(),
                'last_page' => $registrations->lastPage(),
                'total' => $registrations->total(),
            ],
        ]);
    }

    public function checkIn(Request $request, int $eventId): JsonResponse
    {
        $event = Event::findOrFail($eventId);

        Gate::authorize('checkIn', $event);

        $validated = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
        ]);

        $user = User::findOrFail($validated['user_id']);

        try {
            $registration = $this->eventService->checkIn($event, $user);
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Check-in successful.',
            'data' => $registration,
        ]);
    }

    public function myRegistrations(Request $request): JsonResponse
    {
        $registrations = $this->eventService->getUpcomingForUser($request->user());

        return response()->json(['data' => $registrations]);
    }

    public function adminIndex(Request $request): JsonResponse
    {
        $events = Event::with('community:id,name,slug', 'creator:id,name,username')
            ->latest()
            ->paginate(20);

        return response()->json([
            'data' => $events->items(),
            'meta' => [
                'current_page' => $events->currentPage(),
                'last_page' => $events->lastPage(),
                'total' => $events->total(),
            ],
        ]);
    }
}
