<?php

namespace App\Http\Controllers;

use App\Services\LiveKitService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class MeetingController extends Controller
{
    /**
     * Start an instant meeting room.
     */
    public function instant(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user || ! $user->isCreatorOrAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Only creators and administrators can host meetings. Normal members can join meetings using an invite link or room code.',
            ], 403);
        }

        $title = $request->input('title') ?: ($user->name . "'s Meeting");
        
        // Generate a Google Meet style code (e.g. abc-defg-hij)
        $part1 = Str::lower(Str::random(3));
        $part2 = Str::lower(Str::random(4));
        $part3 = Str::lower(Str::random(3));
        $code = "{$part1}-{$part2}-{$part3}";
        $roomName = "meeting-{$code}";

        try {
            $service = app(LiveKitService::class);
            $token = $service->generateToken(
                identity: (string) $user->id,
                roomName: $roomName,
                metadata: json_encode([
                    'name' => $user->name,
                    'username' => $user->username ?? '',
                    'role' => 'host',
                ]),
                canPublish: true,
                canSubscribe: true,
                name: $user->name,
            );

            $host = config('livekit.host') ?: env('LIVEKIT_HOST', 'http://localhost:7880');

            $data = [
                'code' => $code,
                'room' => $roomName,
                'title' => $title,
                'token' => $token,
                'host' => $host,
                'host_user_id' => $user->id,
                'is_host' => true,
                'meeting_url' => "/app/meeting/{$code}",
            ];

            return response()->json([
                'success' => true,
                'data' => $data,
                'code' => $code,
                'room' => $roomName,
                'title' => $title,
                'token' => $token,
                'host' => $host,
                'host_user_id' => $user->id,
                'is_host' => true,
                'meeting_url' => "/app/meeting/{$code}",
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }

    /**
     * Join an existing meeting room by code.
     */
    public function token(Request $request, string $code): JsonResponse
    {
        $user = $request->user();
        $code = trim(strtolower($code));
        $roomName = "meeting-{$code}";

        try {
            $service = app(LiveKitService::class);
            $token = $service->generateToken(
                identity: (string) $user->id,
                roomName: $roomName,
                metadata: json_encode([
                    'name' => $user->name,
                    'username' => $user->username ?? '',
                    'role' => 'participant',
                ]),
                canPublish: true,
                canSubscribe: true,
                name: $user->name,
            );

            $host = config('livekit.host') ?: env('LIVEKIT_HOST', 'http://localhost:7880');

            $data = [
                'code' => $code,
                'room' => $roomName,
                'token' => $token,
                'host' => $host,
                'is_host' => false,
            ];

            return response()->json([
                'success' => true,
                'data' => $data,
                'code' => $code,
                'room' => $roomName,
                'token' => $token,
                'host' => $host,
                'is_host' => false,
            ]);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 503);
        }
    }
}
