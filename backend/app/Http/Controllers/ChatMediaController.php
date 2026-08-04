<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\Media;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ChatMediaController extends Controller
{
    public function show(Request $request, Media $media): JsonResponse
    {
        $user = $request->user();

        $message = Message::where('media_id', $media->id)
            ->visible()
            ->first();

        if (! $message) {
            return response()->json(['message' => 'Media not found or no longer available.'], 404);
        }

        $conversation = $message->conversation;
        if (! $conversation) {
            return response()->json(['message' => 'Media not found.'], 404);
        }

        if ($conversation->type === 'community' && $conversation->community_id) {
            $community = Community::find($conversation->community_id);
            if (! $community) {
                return response()->json(['message' => 'Community not found.'], 404);
            }

            $isBanned = CommunityMembership::where('community_id', $community->id)
                ->where('user_id', $user->id)
                ->where('status', 'banned')
                ->exists();

            if ($isBanned) {
                return response()->json(['message' => 'You are banned from this community.'], 403);
            }

            $isMember = CommunityMembership::where('community_id', $community->id)
                ->where('user_id', $user->id)
                ->whereIn('status', ['active', 'approved'])
                ->exists();

            $isOwner = $community->user_id === $user->id;

            if (! $isMember && ! $isOwner) {
                return response()->json(['message' => 'You are not a member of this community.'], 403);
            }

            if ($community->chat_lock) {
                return response()->json(['message' => 'Community chat is locked.'], 403);
            }
        } else {
            $isParticipant = $conversation->participants()
                ->where('user_id', $user->id)
                ->exists();

            if (! $isParticipant) {
                return response()->json(['message' => 'You do not have access to this media.'], 403);
            }
        }

        if ($media->disk === 'local' || $media->disk === 'local_uploads' || $media->disk === 'public') {
            if (! Storage::disk($media->disk)->exists($media->path)) {
                return response()->json(['message' => 'File not found on storage.'], 404);
            }
            return response()->json([
                'data' => [
                    'url' => Storage::disk($media->disk)->url($media->path),
                    'original_name' => $media->original_name,
                    'mime_type' => $media->mime_type,
                    'size_bytes' => $media->size_bytes,
                ],
            ]);
        }

        $url = Storage::disk($media->disk)->temporaryUrl($media->path, now()->addHour());

        return response()->json([
            'data' => [
                'url' => $url,
                'original_name' => $media->original_name,
                'mime_type' => $media->mime_type,
                'size_bytes' => $media->size_bytes,
            ],
        ]);
    }
}
