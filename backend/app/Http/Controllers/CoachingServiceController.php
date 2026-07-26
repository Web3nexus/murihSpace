<?php

namespace App\Http\Controllers;

use App\Models\CoachingService;
use App\Models\CoachingSlot;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CoachingServiceController extends Controller
{
    public function indexPublic(): JsonResponse
    {
        $services = CoachingService::with('creator:id,name,username,avatar_url')
            ->active()
            ->latest()
            ->get();

        return response()->json(['data' => $services]);
    }

    public function myServices(Request $request): JsonResponse
    {
        $services = CoachingService::withCount([
            'bookings as upcoming_bookings' => fn ($q) => $q->where('start_time', '>', now())->where('status', 'confirmed'),
            'slots as available_slots' => fn ($q) => $q->available(),
        ])
            ->forCreator($request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $services]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isCreatorOrAdmin()) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'duration_minutes' => ['required', 'integer', 'min:15', 'max:480'],
            'price' => ['required', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'location_type' => ['nullable', 'in:online,in_person'],
            'meeting_url' => ['nullable', 'string', 'url', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
            'buffer_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
            'max_daily_bookings' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $validated['creator_id'] = $request->user()->id;
        $validated['currency'] ??= 'NGN';

        $service = CoachingService::create($validated);

        return response()->json(['data' => $service], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $service = CoachingService::with('creator:id,name,username,avatar_url')
            ->findOrFail($id);

        $availableSlots = $service->upcomingSlots()->get();

        return response()->json([
            'data' => $service,
            'available_slots' => $availableSlots,
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $service = CoachingService::findOrFail($id);

        if ($service->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'duration_minutes' => ['sometimes', 'integer', 'min:15', 'max:480'],
            'price' => ['sometimes', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'location_type' => ['nullable', 'in:online,in_person'],
            'meeting_url' => ['nullable', 'string', 'url', 'max:2000'],
            'is_active' => ['nullable', 'boolean'],
            'buffer_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
            'max_daily_bookings' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);

        $service->update($validated);

        return response()->json(['data' => $service->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $service = CoachingService::findOrFail($id);

        if ($service->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($service->bookings()->where('start_time', '>', now())->where('status', 'confirmed')->exists()) {
            return response()->json(['message' => 'Deactivate instead — you have upcoming bookings.'], 409);
        }

        $service->delete();

        return response()->json(['message' => 'Service deleted.']);
    }

    public function generateSlots(Request $request, int $id): JsonResponse
    {
        $service = CoachingService::findOrFail($id);

        if ($service->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'dates' => ['required', 'array', 'min:1', 'max:30'],
            'dates.*' => ['required', 'date', 'after:today'],
            'start_time' => ['required', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'end_time' => ['required', 'string', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/', 'after:start_time'],
        ]);

        $created = 0;
        $duration = $service->duration_minutes;
        $buffer = $service->buffer_minutes;

        foreach ($validated['dates'] as $dateStr) {
            $date = Carbon::parse($dateStr);
            $dayStart = $date->copy()->setTimeFromTimeString($validated['start_time']);
            $dayEnd = $date->copy()->setTimeFromTimeString($validated['end_time']);

            $current = $dayStart->copy();
            while ($current->copy()->addMinutes($duration)->lte($dayEnd)) {
                $slotEnd = $current->copy()->addMinutes($duration);

                $exists = CoachingSlot::where('service_id', $service->id)
                    ->where('start_time', $current)
                    ->exists();

                if (! $exists) {
                    CoachingSlot::create([
                        'service_id' => $service->id,
                        'start_time' => $current,
                        'end_time' => $slotEnd,
                    ]);
                    $created++;
                }

                $current = $slotEnd->addMinutes($buffer);
            }
        }

        return response()->json([
            'message' => "Created {$created} available slot(s).",
            'created' => $created,
        ], 201);
    }

    public function slots(Request $request, int $id): JsonResponse
    {
        $service = CoachingService::findOrFail($id);

        $slots = CoachingSlot::where('service_id', $service->id)
            ->upcoming()
            ->get();

        return response()->json(['data' => $slots]);
    }

    public function deleteSlot(Request $request, int $id, int $slotId): JsonResponse
    {
        $service = CoachingService::findOrFail($id);

        if ($service->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $slot = CoachingSlot::where('service_id', $service->id)
            ->findOrFail($slotId);

        if ($slot->is_booked) {
            return response()->json(['message' => 'Cannot delete a booked slot.'], 409);
        }

        $slot->delete();

        return response()->json(['message' => 'Slot deleted.']);
    }
}
