<?php

namespace App\Http\Controllers;

use App\Events\NotificationBroadcast;
use App\Models\SystemBroadcast;
use App\Models\User;
use App\Notifications\MurihOfficialNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;

class AdminBroadcastController extends Controller
{
    /**
     * List all administrator broadcasts.
     */
    public function index(): JsonResponse
    {
        $broadcasts = SystemBroadcast::with('admin:id,name,username,avatar')
            ->latest()
            ->paginate(20);

        return response()->json([
            'data' => $broadcasts,
        ]);
    }

    /**
     * Compose and dispatch a new general broadcast.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:5000'],
            'type' => ['required', 'string', 'in:announcement,security_alert,system_update,policy_update'],
            'target_audience' => ['required', 'string', 'in:all,creators,vendors,members'],
            'action_url' => ['nullable', 'string', 'max:255'],
            'action_label' => ['nullable', 'string', 'max:100'],
        ]);

        $admin = $request->user();

        // Calculate recipient query
        $userQuery = User::whereNull('deleted_at')
            ->whereNotIn('status', ['banned', 'suspended', 'deleted']);

        if ($validated['target_audience'] === 'creators') {
            $userQuery->where('role', 'creator');
        } elseif ($validated['target_audience'] === 'vendors') {
            $userQuery->where('role', 'vendor');
        } elseif ($validated['target_audience'] === 'members') {
            $userQuery->where('role', 'user');
        }

        $recipientsCount = $userQuery->count();

        $broadcast = SystemBroadcast::create([
            'admin_id' => $admin->id,
            'title' => $validated['title'],
            'body' => $validated['body'],
            'type' => $validated['type'],
            'target_audience' => $validated['target_audience'],
            'action_url' => $validated['action_url'] ?? null,
            'action_label' => $validated['action_label'] ?? null,
            'recipients_count' => $recipientsCount,
            'sent_at' => now(),
        ]);

        // Dispatch notifications in chunks to recipients
        $userQuery->chunk(100, function ($users) use ($broadcast) {
            $notification = new MurihOfficialNotification(
                type: $broadcast->type,
                title: $broadcast->title,
                body: $broadcast->body,
                actionUrl: $broadcast->action_url,
                actionLabel: $broadcast->action_label,
                route: $broadcast->action_url,
                metadata: [
                    'broadcast_id' => $broadcast->id,
                    'type' => $broadcast->type,
                    'is_broadcast' => true,
                ]
            );

            Notification::send($users, $notification);

            foreach ($users as $u) {
                try {
                    NotificationBroadcast::dispatch($u->id, [
                        'id' => (string) \Illuminate\Support\Str::uuid(),
                        'type' => $broadcast->type,
                        'is_official' => true,
                        'sender_name' => 'Murih Notifications Official',
                        'title' => $broadcast->title,
                        'body' => $broadcast->body,
                        'action_url' => $broadcast->action_url,
                        'action_label' => $broadcast->action_label,
                        'created_at' => now()->toIso8601String(),
                        'metadata' => [
                            'broadcast_id' => $broadcast->id,
                            'type' => $broadcast->type,
                            'is_broadcast' => true,
                        ],
                    ]);
                } catch (\Throwable) {
                    // WebSocket dispatch resilience
                }
            }
        });

        return response()->json([
            'message' => "Broadcast successfully dispatched to {$recipientsCount} users.",
            'broadcast' => $broadcast->load('admin:id,name,username,avatar'),
        ], 201);
    }

    /**
     * Delete an existing broadcast.
     */
    public function destroy(int $id): JsonResponse
    {
        $broadcast = SystemBroadcast::findOrFail($id);
        $broadcast->delete();

        return response()->json([
            'message' => 'Broadcast deleted successfully.',
        ]);
    }
}

