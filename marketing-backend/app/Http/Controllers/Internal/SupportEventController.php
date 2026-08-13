<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Models\SupportEvent;
use App\Services\SupportEventProcessor;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportEventController extends Controller
{
    public function __construct(
        protected SupportEventProcessor $processor
    ) {}

    /**
     * POST /api/internal/events
     *
     * Receive a webhook event pushed by the main application (queued on their
     * side). Persisted idempotently: re-deliveries with the same event_id are
     * acknowledged without reprocessing.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_id' => ['required', 'string', 'max:100'],
            'event_key' => ['required', 'string', 'max:100'],
            'occurred_at' => ['nullable', 'date'],
            'actor_type' => ['nullable', 'string', 'max:40'],
            'actor_reference' => ['nullable', 'string', 'max:100'],
            'customer_email' => ['nullable', 'email', 'max:320'],
            'payload' => ['nullable', 'array'],
        ]);

        try {
            $event = SupportEvent::create([
                'event_id' => $validated['event_id'],
                'event_key' => $validated['event_key'],
                'actor_type' => $validated['actor_type'] ?? null,
                'actor_reference' => $validated['actor_reference'] ?? null,
                'customer_email' => $validated['customer_email'] ?? null,
                'payload' => $validated['payload'] ?? null,
                'status' => 'received',
                'occurred_at' => $validated['occurred_at'] ?? null,
            ]);
        } catch (UniqueConstraintViolationException) {
            return response()->json(['success' => true, 'data' => ['duplicate' => true]], 200);
        }

        $this->processor->process($event);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $event->id,
                'event_id' => $event->event_id,
                'event_key' => $event->event_key,
                'status' => $event->status,
                'ticket_number' => $event->ticket_number,
            ],
        ], 201);
    }

    /**
     * GET /api/internal/events/{event_id}
     *
     * Optional lookup for debugging / idempotency checks.
     */
    public function show(string $eventId): JsonResponse
    {
        $event = SupportEvent::query()->where('event_id', $eventId)->first();

        if (! $event) {
            return response()->json(['success' => false, 'data' => null, 'message' => 'Event not found.'], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $event->only(['event_id', 'event_key', 'status', 'ticket_number', 'occurred_at', 'created_at']),
        ]);
    }
}
