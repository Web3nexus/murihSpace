<?php

namespace App\Http\Controllers;

use App\Models\FriendRequest;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FriendRequestController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Map a user to the shape the frontend expects.
     */
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'avatar' => $user->avatar,
            'avatar_url' => $user->avatar,
            'bio' => $user->bio,
        ];
    }

    /**
     * Count how many friends two users share.
     */
    private function mutualFriendsCount(int $userId, int $otherId): int
    {
        $userFriends = DB::table('friend_requests')
            ->where('status', FriendRequest::STATUS_ACCEPTED)
            ->where(function ($q) use ($userId) {
                $q->where('sender_id', $userId)->orWhere('receiver_id', $userId);
            })
            ->get(['sender_id', 'receiver_id'])
            ->map(fn ($row) => $row->sender_id === $userId ? $row->receiver_id : $row->sender_id)
            ->unique()
            ->values();

        $otherFriends = DB::table('friend_requests')
            ->where('status', FriendRequest::STATUS_ACCEPTED)
            ->where(function ($q) use ($otherId) {
                $q->where('sender_id', $otherId)->orWhere('receiver_id', $otherId);
            })
            ->get(['sender_id', 'receiver_id'])
            ->map(fn ($row) => $row->sender_id === $otherId ? $row->receiver_id : $row->sender_id)
            ->unique();

        return $userFriends->intersect($otherFriends)->count();
    }

    /**
     * Incoming pending friend requests.
     */
    public function index(Request $request): JsonResponse
    {
        $requests = FriendRequest::with('sender:id,name,username,avatar,bio')
            ->where('receiver_id', $request->user()->id)
            ->pending()
            ->latest()
            ->get()
            ->map(fn (FriendRequest $r) => [
                'id' => $r->id,
                'sender' => $r->sender ? $this->userPayload($r->sender) : null,
                'mutual_friends' => $r->sender ? $this->mutualFriendsCount($request->user()->id, $r->sender_id) : 0,
                'status' => $r->status,
                'created_at' => $r->created_at,
            ]);

        return response()->json(['data' => $requests]);
    }

    /**
     * Outgoing pending friend requests.
     */
    public function sent(Request $request): JsonResponse
    {
        $requests = FriendRequest::with('receiver:id,name,username,avatar,bio')
            ->where('sender_id', $request->user()->id)
            ->pending()
            ->latest()
            ->get()
            ->map(fn (FriendRequest $r) => [
                'id' => $r->id,
                'receiver' => $r->receiver ? $this->userPayload($r->receiver) : null,
                'status' => $r->status,
                'created_at' => $r->created_at,
            ]);

        return response()->json(['data' => $requests]);
    }

    /**
     * List the user's friends (accepted requests, both directions).
     */
    public function friends(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $friends = FriendRequest::with('sender:id,name,username,avatar,bio', 'receiver:id,name,username,avatar,bio')
            ->accepted()
            ->where(fn (Builder $q) => $q->where('sender_id', $userId)->orWhere('receiver_id', $userId))
            ->latest()
            ->get()
            ->map(function (FriendRequest $r) use ($userId) {
                $friend = $r->sender_id === $userId ? $r->receiver : $r->sender;

                return [
                    'id' => $r->id,
                    'friend' => $friend ? $this->userPayload($friend) : null,
                    'mutual_friends' => $friend ? $this->mutualFriendsCount($userId, $friend->id) : 0,
                    'since' => $r->created_at,
                ];
            })
            ->sortByDesc('since')
            ->values();

        return response()->json(['data' => $friends]);
    }

    /**
     * Search users to add as friends (excludes self, existing friends,
     * and anyone already involved in a request with the current user).
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => ['required', 'string', 'max:100'],
        ]);

        $q = trim($request->input('q'));
        $userId = $request->user()->id;

        $relatedUserIds = FriendRequest::where(fn (Builder $query) => $query
            ->where('sender_id', $userId)
            ->orWhere('receiver_id', $userId))
            ->pluck('sender_id')
            ->merge(FriendRequest::where(fn (Builder $query) => $query
                ->where('sender_id', $userId)
                ->orWhere('receiver_id', $userId))
                ->pluck('receiver_id'))
            ->push($userId)
            ->unique();

        $users = User::whereNotIn('id', $relatedUserIds)
            ->where(fn (Builder $query) => $query
                ->where('name', 'ilike', "%{$q}%")
                ->orWhere('username', 'ilike', "%{$q}%"))
            ->limit(10)
            ->get()
            ->map(fn (User $u) => $this->userPayload($u));

        return response()->json(['data' => $users]);
    }

    /**
     * Send a friend request.
     */
    public function send(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $sender = $request->user();
        $receiverId = (int) $request->input('user_id');

        if ($sender->id === $receiverId) {
            return response()->json(['message' => 'You cannot send a friend request to yourself.'], 422);
        }

        $existing = FriendRequest::where(function (Builder $q) use ($sender, $receiverId) {
            $q->where('sender_id', $sender->id)->where('receiver_id', $receiverId);
        })->orWhere(function (Builder $q) use ($sender, $receiverId) {
            $q->where('sender_id', $receiverId)->where('receiver_id', $sender->id);
        })->first();

        if ($existing) {
            if ($existing->status === FriendRequest::STATUS_ACCEPTED) {
                return response()->json(['message' => 'You are already friends with this user.'], 422);
            }
            if ($existing->status === FriendRequest::STATUS_PENDING) {
                $message = $existing->sender_id === $sender->id
                    ? 'Friend request already sent.'
                    : 'This user has already sent you a friend request.';

                return response()->json(['message' => $message], 422);
            }

            // Declined: reuse the row so the unique pair is not violated.
            $existing->update([
                'sender_id' => $sender->id,
                'receiver_id' => $receiverId,
                'status' => FriendRequest::STATUS_PENDING,
            ]);

            try {
                $receiver = User::find($receiverId);
                if ($receiver) {
                    $this->notifications->actionEmail(
                        user: $receiver,
                        title: $sender->name.' sent you a friend request',
                        bodyHtml: '<p>Hi '.e($receiver->name).',</p><p><strong>'.e($sender->name).'</strong> sent you a friend request on MurihSpace. Open your friend requests to review it.</p>',
                        actionLabel: 'View friend requests',
                        actionUrl: NotificationService::link('app/friends'),
                        template: 'friend_request_received',
                        data: ['from_name' => e($sender->name)],
                    );
                }
            } catch (\Throwable $e) {
                report($e);
            }

            return response()->json([
                'message' => 'Friend request sent.',
                'data' => $existing,
            ], 201);
        }

        $friendRequest = FriendRequest::create([
            'sender_id' => $sender->id,
            'receiver_id' => $receiverId,
            'status' => FriendRequest::STATUS_PENDING,
        ]);

        try {
            $receiver = User::find($receiverId);
            if ($receiver) {
                $this->notifications->actionEmail(
                    user: $receiver,
                    title: $sender->name.' sent you a friend request',
                    bodyHtml: '<p>Hi '.e($receiver->name).',</p><p><strong>'.e($sender->name).'</strong> sent you a friend request on MurihSpace. Open your friend requests to review it.</p>',
                    actionLabel: 'View friend requests',
                    actionUrl: NotificationService::link('app/friends'),
                    template: 'friend_request_received',
                    data: ['from_name' => e($sender->name)],
                );
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => 'Friend request sent.',
            'data' => $friendRequest,
        ], 201);
    }

    /**
     * Accept an incoming friend request.
     */
    public function accept(Request $request, int $id): JsonResponse
    {
        $friendRequest = FriendRequest::where('id', $id)
            ->where('receiver_id', $request->user()->id)
            ->pending()
            ->firstOrFail();

        $friendRequest->update(['status' => FriendRequest::STATUS_ACCEPTED]);

        try {
            $sender = User::find($friendRequest->sender_id);
            $receiver = User::find($friendRequest->receiver_id);
            if ($sender && $receiver) {
                $this->notifications->actionEmail(
                    user: $sender,
                    title: $receiver->name.' accepted your friend request',
                    bodyHtml: '<p>Great news — <strong>'.e($receiver->name).'</strong> accepted your friend request. You are now connected on MurihSpace.</p>',
                    actionLabel: 'View friends',
                    actionUrl: NotificationService::link('app/friends'),
                    template: 'friend_request_accepted',
                    data: ['from_name' => e($receiver->name)],
                );
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => 'Friend request accepted.',
            'data' => $friendRequest,
        ]);
    }

    /**
     * Decline an incoming friend request.
     */
    public function decline(Request $request, int $id): JsonResponse
    {
        $friendRequest = FriendRequest::where('id', $id)
            ->where('receiver_id', $request->user()->id)
            ->pending()
            ->firstOrFail();

        $friendRequest->update(['status' => FriendRequest::STATUS_DECLINED]);

        return response()->json([
            'message' => 'Friend request declined.',
        ]);
    }

    /**
     * Cancel an outgoing friend request.
     */
    public function cancel(Request $request, int $id): JsonResponse
    {
        $friendRequest = FriendRequest::where('id', $id)
            ->where('sender_id', $request->user()->id)
            ->pending()
            ->firstOrFail();

        $friendRequest->delete();

        return response()->json([
            'message' => 'Friend request cancelled.',
        ]);
    }

    /**
     * Unfriend / remove an accepted friendship.
     */
    public function unfriend(Request $request, int $userId): JsonResponse
    {
        $me = $request->user()->id;

        if ($me === $userId) {
            return response()->json(['message' => 'Invalid request.'], 422);
        }

        $deleted = FriendRequest::accepted()
            ->where(function (Builder $q) use ($me, $userId) {
                $q->where('sender_id', $me)->where('receiver_id', $userId);
            })
            ->orWhere(function (Builder $q) use ($me, $userId) {
                $q->where('sender_id', $userId)->where('receiver_id', $me);
            })
            ->delete();

        if (! $deleted) {
            return response()->json(['message' => 'You are not friends with this user.'], 404);
        }

        return response()->json(['message' => 'Friend removed.']);
    }
}
