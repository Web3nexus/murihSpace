<?php

namespace App\Http\Controllers;

use App\Jobs\SendBroadcastEmail;
use App\Models\EmailBroadcast;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Bus;

class EmailBroadcastController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $broadcasts = EmailBroadcast::where('creator_id', $request->user()->id)
            ->latest()
            ->get()
            ->map(fn($b) => [
                'id' => $b->id,
                'title' => $b->title,
                'subject' => $b->subject,
                'status' => $b->status,
                'recipient_count' => $b->recipient_count,
                'sent_count' => $b->sent_count,
                'open_count' => $b->open_count,
                'click_count' => $b->click_count,
                'sent_at' => $b->sent_at?->toIso8601String(),
                'created_at' => $b->created_at->toIso8601String(),
            ]);

        return response()->json(['data' => $broadcasts]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'subject' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string', 'max:50000'],
        ]);

        $validated['creator_id'] = $request->user()->id;

        $broadcast = EmailBroadcast::create($validated);

        return response()->json(['data' => $broadcast], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $broadcast = EmailBroadcast::where('creator_id', $request->user()->id)->findOrFail($id);

        return response()->json(['data' => $broadcast]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $broadcast = EmailBroadcast::where('creator_id', $request->user()->id)->findOrFail($id);

        if ($broadcast->status !== 'draft') {
            return response()->json(['message' => 'Only draft broadcasts can be edited.'], 422);
        }

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'subject' => ['sometimes', 'string', 'max:255'],
            'content' => ['sometimes', 'string', 'max:50000'],
        ]);

        $broadcast->update($validated);

        return response()->json(['data' => $broadcast->fresh()]);
    }

    public function send(Request $request, int $id): JsonResponse
    {
        $broadcast = EmailBroadcast::where('creator_id', $request->user()->id)->findOrFail($id);

        if ($broadcast->status !== 'draft') {
            return response()->json(['message' => 'Broadcast already sent or sending.'], 422);
        }

        $subscribers = User::query()
            ->whereIn('id', Subscription::where('creator_id', $broadcast->creator_id)
                ->active()
                ->select('subscriber_id')
                ->distinct()
            )->get();

        $recipientCount = $subscribers->count();

        $broadcast->update([
            'status' => 'sending',
            'sent_at' => now(),
            'recipient_count' => $recipientCount,
            'sent_count' => 0,
        ]);

        if ($recipientCount > 0) {
            $jobs = $subscribers->map(
                fn($subscriber) => new SendBroadcastEmail($broadcast, $subscriber)
            );

            Bus::batch($jobs)->dispatch();
        }

        $broadcast->fresh()->update([
            'status' => 'sent',
            'sent_count' => $recipientCount,
        ]);

        return response()->json(['data' => $broadcast->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $broadcast = EmailBroadcast::where('creator_id', $request->user()->id)->findOrFail($id);
        $broadcast->delete();

        return response()->json(['message' => 'Broadcast deleted.']);
    }
}
