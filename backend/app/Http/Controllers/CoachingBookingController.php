<?php

namespace App\Http\Controllers;

use App\Models\CoachingBooking;
use App\Models\CoachingService;
use App\Models\CoachingSlot;
use App\Models\Wallet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CoachingBookingController extends Controller
{
    public function myBookings(Request $request): JsonResponse
    {
        $bookings = CoachingBooking::with([
            'service:id,name,duration_minutes,location_type,meeting_url',
            'service.creator:id,name,username,avatar',
        ])
            ->forBooker($request->user()->id)
            ->orderBy('start_time', 'desc')
            ->get();

        return response()->json(['data' => $bookings]);
    }

    public function mySessions(Request $request): JsonResponse
    {
        $bookings = CoachingBooking::with([
            'service:id,name,duration_minutes,location_type,meeting_url',
            'booker:id,name,username,avatar',
        ])
            ->forCreator($request->user()->id)
            ->orderBy('start_time', 'desc')
            ->get();

        return response()->json(['data' => $bookings]);
    }

    public function book(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'service_id' => ['required', 'integer', 'exists:coaching_services,id'],
            'slot_id' => ['required', 'integer', 'exists:coaching_slots,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $service = CoachingService::findOrFail($validated['service_id']);

        if (! $service->is_active) {
            return response()->json(['message' => 'This service is no longer available.'], 400);
        }

        if ($service->creator_id === $request->user()->id) {
            return response()->json(['message' => 'You cannot book your own service.'], 400);
        }

        $slot = CoachingSlot::where('service_id', $service->id)
            ->where('id', $validated['slot_id'])
            ->where('is_booked', false)
            ->where('start_time', '>', now())
            ->first();

        if (! $slot) {
            return response()->json(['message' => 'This slot is no longer available.'], 409);
        }

        // Check daily limit
        if ($service->max_daily_bookings) {
            $dailyCount = CoachingBooking::where('service_id', $service->id)
                ->whereDate('start_time', $slot->start_time->toDateString())
                ->count();

            if ($dailyCount >= $service->max_daily_bookings) {
                return response()->json(['message' => 'Daily booking limit reached for this service.'], 409);
            }
        }

        // Payment check for paid services
        if ($service->price > 0) {
            $wallet = Wallet::where('user_id', $request->user()->id)->first();
            if (! $wallet || $wallet->balance < $service->price) {
                return response()->json([
                    'message' => 'Insufficient wallet balance.',
                    'required' => $service->price,
                    'balance' => $wallet?->balance ?? 0,
                ], 402);
            }
        }

        $booking = DB::transaction(function () use ($service, $slot, $request, $validated) {
            $slot->update(['is_booked' => true]);

            if ($service->price > 0) {
                Wallet::where('user_id', $request->user()->id)->decrement('balance', $service->price);
            }

            $meetingUrl = $validated['meeting_url'] ?? $service->meeting_url;

            return CoachingBooking::create([
                'service_id' => $service->id,
                'slot_id' => $slot->id,
                'booker_id' => $request->user()->id,
                'start_time' => $slot->start_time,
                'end_time' => $slot->end_time,
                'status' => 'confirmed',
                'notes' => $validated['notes'] ?? null,
                'meeting_url' => $meetingUrl,
                'price_paid' => $service->price,
                'currency' => $service->currency,
            ]);
        });

        $booking->load([
            'service:id,name,duration_minutes,location_type,meeting_url',
            'service.creator:id,name,username,avatar',
        ]);

        return response()->json(['data' => $booking], 201);
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $booking = CoachingBooking::findOrFail($id);

        if ($booking->booker_id !== $request->user()->id && $booking->service->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (! in_array($booking->status, ['confirmed', 'pending'])) {
            return response()->json(['message' => 'Booking cannot be cancelled.'], 400);
        }

        DB::transaction(function () use ($booking) {
            $booking->update(['status' => 'cancelled']);

            if ($booking->slot_id) {
                CoachingSlot::where('id', $booking->slot_id)->update(['is_booked' => false]);
            }

            if ($booking->price_paid > 0) {
                Wallet::where('user_id', $booking->booker_id)->increment('balance', $booking->price_paid);
            }
        });

        return response()->json(['message' => 'Booking cancelled and refunded.']);
    }

    public function complete(Request $request, int $id): JsonResponse
    {
        $booking = CoachingBooking::findOrFail($id);

        if ($booking->service->creator_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($booking->status !== 'confirmed') {
            return response()->json(['message' => 'Only confirmed bookings can be marked complete.'], 400);
        }

        $booking->update(['status' => 'completed']);

        return response()->json(['message' => 'Session marked as completed.']);
    }
}
