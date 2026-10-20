<?php

namespace App\Http\Controllers;

use App\Models\FriendRequest;
use App\Models\User;
use App\Models\UserLocation;
use App\Services\NotificationService;
use App\Services\Recommendation\UserRecommendationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class FriendRequestController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly UserRecommendationService $recommendations,
    ) {}

    /**
     * Map a user to the shape the frontend expects.
     */
    private function userPayload(User $user): array
    {
        $avatar = $user->avatar_url ?? $user->avatar;
        if ($avatar && ! str_starts_with($avatar, 'http')) {
            $avatar = url(str_starts_with($avatar, '/') ? $avatar : '/storage/'.ltrim($avatar, '/'));
        }

        return [
            'id' => $user->id,
            'name' => $user->name,
            'username' => $user->username,
            'avatar' => $avatar,
            'avatar_url' => $avatar,
            'banner_url' => $user->banner_url ?? null,
            'bio' => $user->bio,
            'birthday' => $user->birthday ? $user->birthday->format('Y-m-d') : null,
            'role' => $user->role,
            'has_active_verification_badge' => (bool) $user->has_active_verification_badge,
            'is_online' => $user->isOnline(),
            'last_seen' => $user->lastSeenForHuman(),
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
        $requests = FriendRequest::with('sender')
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
        $requests = FriendRequest::with('receiver')
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

        $friends = FriendRequest::with('sender', 'receiver')
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
     * Search users to add as friends or connect with.
     * Returns matching users with their actual friendship status.
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => ['required', 'string', 'max:100'],
        ]);

        $q = trim($request->input('q'));
        $cleanQ = ltrim($q, '@'); // strip leading @
        $userId = $request->user()->id;
        $like = DB::connection()->getDriverName() === 'pgsql' ? 'ilike' : 'like';

        $users = User::nonAdmin()
            ->where('id', '!=', $userId)
            ->whereNull('deleted_at')
            ->where(function (Builder $query) use ($q, $cleanQ, $like) {
                // People are found by name or username only. Phone numbers and
                // emails are never searchable, so they can't be used to look up accounts.
                $query->where('name', $like, "%{$q}%")
                    ->orWhere('username', $like, "%{$cleanQ}%");
            })
            ->orderByRaw('CASE 
                WHEN LOWER(username) = LOWER(?) THEN 0 
                WHEN LOWER(username) LIKE LOWER(?) THEN 1 
                WHEN LOWER(name) LIKE LOWER(?) THEN 2 
                ELSE 3 END', [$cleanQ, "{$cleanQ}%", "{$q}%"])
            ->limit(30)
            ->get()
            ->map(function (User $u) use ($userId) {
                $friendship = FriendRequest::where(function (Builder $query) use ($userId, $u) {
                    $query->where('sender_id', $userId)->where('receiver_id', $u->id);
                })->orWhere(function (Builder $query) use ($userId, $u) {
                    $query->where('sender_id', $u->id)->where('receiver_id', $userId);
                })->first();

                $status = 'none';
                $requestId = 0;
                if ($friendship) {
                    $requestId = $friendship->id;
                    if ($friendship->status === FriendRequest::STATUS_ACCEPTED) {
                        $status = 'accepted';
                    } elseif ($friendship->status === FriendRequest::STATUS_PENDING) {
                        $status = $friendship->sender_id === $userId ? 'pending_sent' : 'pending_received';
                    }
                }

                $payload = $this->userPayload($u);
                $payload['request_id'] = $requestId;
                $payload['mutual_friends'] = $this->mutualFriendsCount($userId, $u->id);
                $payload['status'] = $status;
                $payload['is_friend'] = $status === 'accepted';

                return $payload;
            });

        return response()->json(['data' => $users]);
    }

    /**
     * Match a list of phone numbers or contact records against registered users.
     */
    public function syncContacts(Request $request): JsonResponse
    {
        $request->validate([
            'contacts' => ['nullable', 'array'],
            'contacts.*.name' => ['nullable', 'string'],
            'contacts.*.phone' => ['nullable', 'string'],
            'phones' => ['nullable', 'array'],
            'phones.*' => ['string'],
        ]);

        $userId = $request->user()->id;
        $rawPhones = collect();

        if ($request->has('phones') && is_array($request->input('phones'))) {
            $rawPhones = $rawPhones->merge($request->input('phones'));
        }

        if ($request->has('contacts') && is_array($request->input('contacts'))) {
            foreach ($request->input('contacts') as $c) {
                if (! empty($c['phone'])) {
                    $rawPhones->push($c['phone']);
                }
            }
        }

        // Normalize phone numbers: remove spaces, dashes, parentheses
        $cleanedPhones = $rawPhones
            ->map(fn ($p) => preg_replace('/[^\d+]/', '', (string) $p))
            ->filter(fn ($p) => strlen((string) $p) >= 7)
            ->unique()
            ->values();

        if ($cleanedPhones->isEmpty()) {
            return response()->json(['data' => []]);
        }

        // Build variations for each phone (e.g. +2348067437000, 08067437000, 8067437000)
        $searchTerms = collect();
        foreach ($cleanedPhones as $phone) {
            $searchTerms->push($phone);
            if (str_starts_with($phone, '+')) {
                $searchTerms->push(substr($phone, 1));
            }
            if (str_starts_with($phone, '+234') && strlen($phone) > 4) {
                $searchTerms->push('0'.substr($phone, 4));
                $searchTerms->push(substr($phone, 4));
            } elseif (str_starts_with($phone, '234') && strlen($phone) > 3) {
                $searchTerms->push('0'.substr($phone, 3));
                $searchTerms->push(substr($phone, 3));
            } elseif (str_starts_with($phone, '0') && strlen($phone) > 1) {
                $searchTerms->push('+234'.substr($phone, 1));
                $searchTerms->push('234'.substr($phone, 1));
                $searchTerms->push(substr($phone, 1));
            }
        }

        $searchTerms = $searchTerms->unique()->values();

        $matchedUsers = User::nonAdmin()
            ->where('id', '!=', $userId)
            ->whereNull('deleted_at')
            ->where(function (Builder $query) use ($searchTerms) {
                foreach ($searchTerms as $term) {
                    $query->orWhere('mobile_number', 'like', "%{$term}%");
                }
            })
            ->limit(100)
            ->get();

        $followingIds = DB::table('follows')
            ->where('follower_id', $userId)
            ->pluck('following_id')
            ->flip();

        $matched = $matchedUsers->map(function (User $u) use ($userId, $followingIds) {
            $friendship = FriendRequest::where(function (Builder $q) use ($userId, $u) {
                $q->where('sender_id', $userId)->where('receiver_id', $u->id);
            })->orWhere(function (Builder $q) use ($userId, $u) {
                $q->where('sender_id', $u->id)->where('receiver_id', $userId);
            })->first();

            $status = 'none';
            $requestId = 0;
            if ($friendship) {
                $requestId = $friendship->id;
                if ($friendship->status === FriendRequest::STATUS_ACCEPTED) {
                    $status = 'accepted';
                } elseif ($friendship->status === FriendRequest::STATUS_PENDING) {
                    $status = $friendship->sender_id === $userId ? 'pending_sent' : 'pending_received';
                }
            }

            return [
                'id' => $u->id,
                'request_id' => $requestId,
                'name' => $u->name,
                'username' => $u->username,
                'avatar_url' => $u->avatar_url ?? $u->avatar,
                'avatar_color' => '0xFF007AFF',
                'bio' => $u->bio,
                'mutual_friends' => $this->mutualFriendsCount($userId, $u->id),
                'status' => $status,
                'is_friend' => $status === 'accepted',
                'is_following' => $followingIds->has($u->id),
                'reason' => 'From your contacts',
            ];
        });

        return response()->json(['data' => $matched->values()]);
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
     * Get suggested users to add as friends (personalized ranking).
     */
    /**
     * Members who opted in to sharing an approximate location and are within the
     * nearby radius, excluding anyone already connected to, following, or blocked
     * by the viewer.
     */
    private function nearbyCandidates(User $viewer, UserLocation $me, int $limit = 10): Collection
    {
        $latDelta = UserLocation::NEARBY_KM / 111.0;
        $lngDelta = UserLocation::NEARBY_KM / max(1.0, 111.0 * cos(deg2rad($me->latitude)));

        $excluded = collect([$viewer->id])
            ->merge($viewer->follows()->pluck('users.id'))
            ->merge(FriendRequest::where('sender_id', $viewer->id)->pluck('receiver_id'))
            ->merge(FriendRequest::where('receiver_id', $viewer->id)->pluck('sender_id'))
            ->merge(DB::table('user_blocks')->where('blocker_id', $viewer->id)->pluck('blocked_id'))
            ->merge(DB::table('user_blocks')->where('blocked_id', $viewer->id)->pluck('blocker_id'))
            ->unique()
            ->all();

        return UserLocation::query()
            ->where('sharing_enabled', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->whereNotIn('user_id', $excluded)
            ->whereHas('user', fn (Builder $q) => $q->nonAdmin()->whereNull('deleted_at'))
            ->whereBetween('latitude', [$me->latitude - $latDelta, $me->latitude + $latDelta])
            ->whereBetween('longitude', [$me->longitude - $lngDelta, $me->longitude + $lngDelta])
            ->get()
            ->map(fn (UserLocation $other) => [
                'id' => $other->user_id,
                'reason' => 'Nearby',
                'km' => UserLocation::distanceKm($me->latitude, $me->longitude, $other->latitude, $other->longitude),
            ])
            ->filter(fn (array $row) => $row['km'] <= UserLocation::NEARBY_KM)
            ->sortBy('km')
            ->take($limit)
            ->values();
    }

    public function suggestions(Request $request): JsonResponse
    {
        $viewer = $request->user();
        $people = $this->recommendations->suggestPeople($viewer, limit: 20);

        // Nearby ranking only applies when both people have opted in to sharing
        // an approximate location. The distance itself is never returned, since
        // distances from several points would reveal where someone is.
        $viewerLocation = UserLocation::firstWhere('user_id', $viewer->id);
        $viewerShared = $viewerLocation?->isShared() ?? false;

        // Nearby members are added even without other signals, so location can
        // surface someone the recommender would otherwise leave out.
        if ($viewerShared) {
            $nearby = $this->nearbyCandidates($viewer, $viewerLocation);
            $existing = $people->pluck('id')->all();
            $people = $people->concat($nearby->reject(fn ($row) => in_array($row['id'], $existing, true)));
        }

        $ranked = $people->map(function ($item, int $position) use ($viewer, $viewerLocation, $viewerShared) {
            $u = User::find($item['id']);
            if (! $u) {
                return null;
            }
            $payload = $this->userPayload($u);
            $payload['mutual_friends'] = $this->mutualFriendsCount($viewer->id, $u->id);
            $payload['reason'] = $item['reason'] ?? null;

            $distance = null;
            if ($viewerShared) {
                $other = UserLocation::firstWhere('user_id', $u->id);
                if ($other?->isShared()) {
                    $km = UserLocation::distanceKm(
                        $viewerLocation->latitude,
                        $viewerLocation->longitude,
                        $other->latitude,
                        $other->longitude,
                    );
                    if ($km <= UserLocation::NEARBY_KM) {
                        $distance = $km;
                        $payload['reason'] = 'Nearby';
                    }
                }
            }

            return ['payload' => $payload, 'sort' => $distance ?? (1000 + $position)];
        })->filter()->sortBy('sort')->values()
            ->map(fn (array $row) => $row['payload']);

        return response()->json(['data' => $ranked]);
    }

    /**
     * Get friendship status between authenticated user and target user.
     */
    public function status(Request $request, int $userId): JsonResponse
    {
        $me = $request->user()->id;

        if ($me === $userId) {
            return response()->json([
                'status' => 'self',
                'is_friend' => false,
                'request_id' => null,
                'mutual_friends' => 0,
            ]);
        }

        $friendRequest = FriendRequest::where(function (Builder $q) use ($me, $userId) {
            $q->where('sender_id', $me)->where('receiver_id', $userId);
        })->orWhere(function (Builder $q) use ($me, $userId) {
            $q->where('sender_id', $userId)->where('receiver_id', $me);
        })->first();

        $status = 'none';
        $requestId = null;
        $isFriend = false;

        if ($friendRequest) {
            $requestId = $friendRequest->id;
            if ($friendRequest->status === FriendRequest::STATUS_ACCEPTED) {
                $status = 'accepted';
                $isFriend = true;
            } elseif ($friendRequest->status === FriendRequest::STATUS_PENDING) {
                $status = $friendRequest->sender_id === $me ? 'pending_sent' : 'pending_received';
            }
        }

        return response()->json([
            'status' => $status,
            'is_friend' => $isFriend,
            'request_id' => $requestId,
            'mutual_friends' => $this->mutualFriendsCount($me, $userId),
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

    /**
     * Get friends with birthdays (today and upcoming in next 60 days).
     */
    public function birthdays(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $friendRequests = FriendRequest::with(['sender', 'receiver'])
            ->accepted()
            ->where(fn (Builder $q) => $q->where('sender_id', $userId)->orWhere('receiver_id', $userId))
            ->get();

        $friends = $friendRequests->map(function (FriendRequest $r) use ($userId) {
            return $r->sender_id === $userId ? $r->receiver : $r->sender;
        })->filter()->unique('id')->values();

        $today = now();
        $todayMonthDay = $today->format('m-d');

        $todayBirthdays = [];
        $upcomingBirthdays = [];

        foreach ($friends as $friend) {
            if (! $friend->birthday) {
                continue;
            }

            $bdayMonthDay = $friend->birthday->format('m-d');
            $payload = $this->userPayload($friend);
            $payload['mutual_friends'] = $this->mutualFriendsCount($userId, $friend->id);

            // Determine next birthday occurrence
            $thisYearBday = $friend->birthday->copy()->year($today->year);
            if ($thisYearBday->isPast() && ! $thisYearBday->isToday()) {
                $thisYearBday->addYear();
            }
            $daysRemaining = (int) $today->startOfDay()->diffInDays($thisYearBday->startOfDay(), false);

            $payload['days_remaining'] = $daysRemaining;
            $payload['formatted_date'] = $friend->birthday->format('F j');

            if ($bdayMonthDay === $todayMonthDay) {
                $todayBirthdays[] = $payload;
            } elseif ($daysRemaining > 0 && $daysRemaining <= 60) {
                $upcomingBirthdays[] = $payload;
            }
        }

        usort($upcomingBirthdays, fn ($a, $b) => $a['days_remaining'] <=> $b['days_remaining']);

        return response()->json([
            'data' => [
                'today' => $todayBirthdays,
                'upcoming' => $upcomingBirthdays,
                'total_with_birthdays' => count($todayBirthdays) + count($upcomingBirthdays),
            ],
        ]);
    }
}
