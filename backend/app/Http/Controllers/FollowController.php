<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FollowController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Toggle follow status for a target user.
     * POST /api/v1/users/{id}/follow
     */
    public function toggleFollow(Request $request, int $id): JsonResponse
    {
        $authUser = $request->user();

        if ($authUser->id === $id) {
            return response()->json([
                'success' => false,
                'message' => 'You cannot follow yourself.',
            ], 422);
        }

        $targetUser = User::findOrFail($id);

        $isFollowing = $authUser->follows()->where('following_id', $targetUser->id)->exists();

        if ($isFollowing) {
            $authUser->follows()->detach($targetUser->id);
            $action = 'unfollowed';
            $following = false;
        } else {
            $authUser->follows()->attach($targetUser->id);
            $action = 'followed';
            $following = true;

            // Notify target user
            try {
                $this->notifications->push(
                    user: $targetUser,
                    title: 'New Follower',
                    body: "{$authUser->name} started following you on MurihSpace.",
                    data: [
                        'type' => 'new_follower',
                        'follower_id' => $authUser->id,
                        'follower_name' => $authUser->name,
                        'route' => "/profile/{$authUser->id}",
                    ],
                );
            } catch (\Throwable $e) {
                \Log::warning("Follow notification failed: {$e->getMessage()}");
            }
        }

        return response()->json([
            'success' => true,
            'action' => $action,
            'is_following' => $following,
            'target_followers_count' => $targetUser->followers()->count(),
            'auth_following_count' => $authUser->follows()->count(),
            'message' => $following ? "You are now following {$targetUser->name}." : "You unfollowed {$targetUser->name}.",
        ]);
    }

    /**
     * Follow a target user.
     * POST /api/v1/users/{id}/follow-user
     */
    public function follow(Request $request, int $id): JsonResponse
    {
        $authUser = $request->user();

        if ($authUser->id === $id) {
            return response()->json(['success' => false, 'message' => 'You cannot follow yourself.'], 422);
        }

        $targetUser = User::findOrFail($id);

        if (! $authUser->follows()->where('following_id', $targetUser->id)->exists()) {
            $authUser->follows()->attach($targetUser->id);

            try {
                $this->notifications->push(
                    user: $targetUser,
                    title: 'New Follower',
                    body: "{$authUser->name} started following you.",
                    data: [
                        'type' => 'new_follower',
                        'follower_id' => $authUser->id,
                    ],
                );
            } catch (\Throwable $e) {
                \Log::warning("Follow notification failed: {$e->getMessage()}");
            }
        }

        return response()->json([
            'success' => true,
            'is_following' => true,
            'target_followers_count' => $targetUser->followers()->count(),
            'auth_following_count' => $authUser->follows()->count(),
            'message' => "You are now following {$targetUser->name}.",
        ]);
    }

    /**
     * Unfollow a target user.
     * DELETE /api/v1/users/{id}/follow
     */
    public function unfollow(Request $request, int $id): JsonResponse
    {
        $authUser = $request->user();
        $targetUser = User::findOrFail($id);

        $authUser->follows()->detach($targetUser->id);

        return response()->json([
            'success' => true,
            'is_following' => false,
            'target_followers_count' => $targetUser->followers()->count(),
            'auth_following_count' => $authUser->follows()->count(),
            'message' => "You unfollowed {$targetUser->name}.",
        ]);
    }

    /**
     * Get follow status and counts for a user.
     * GET /api/v1/users/{id}/follow-status
     */
    public function status(Request $request, int $id): JsonResponse
    {
        $authUser = $request->user();
        $targetUser = User::findOrFail($id);

        $isFollowing = $authUser ? $authUser->follows()->where('following_id', $targetUser->id)->exists() : false;

        return response()->json([
            'user_id' => $targetUser->id,
            'is_following' => $isFollowing,
            'followers_count' => $targetUser->followers()->count(),
            'following_count' => $targetUser->follows()->count(),
            'posts_count' => $targetUser->posts()->count(),
        ]);
    }

    /**
     * List followers of a user.
     * GET /api/v1/users/{id}/followers
     */
    public function followers(Request $request, int $id): JsonResponse
    {
        $authUser = $request->user();
        $targetUser = User::findOrFail($id);

        $followers = $targetUser->followers()
            ->select('users.id', 'users.name', 'users.username', 'users.avatar', 'users.bio', 'users.role', 'users.kyc_status', 'users.verification_badge_status')
            ->paginate(30);

        $followingIds = $authUser ? $authUser->follows()->pluck('following_id')->toArray() : [];

        $data = $followers->through(function ($user) use ($followingIds, $authUser) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'avatar' => $user->avatar,
                'bio' => $user->bio,
                'role' => $user->role,
                'is_verified' => $user->kyc_status === 'verified' || $user->hasActiveVerificationBadge(),
                'is_following' => in_array($user->id, $followingIds, true),
                'is_self' => $authUser && $authUser->id === $user->id,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }

    /**
     * List users that a target user is following.
     * GET /api/v1/users/{id}/following
     */
    public function following(Request $request, int $id): JsonResponse
    {
        $authUser = $request->user();
        $targetUser = User::findOrFail($id);

        $following = $targetUser->follows()
            ->select('users.id', 'users.name', 'users.username', 'users.avatar', 'users.bio', 'users.role', 'users.kyc_status', 'users.verification_badge_status')
            ->paginate(30);

        $authFollowingIds = $authUser ? $authUser->follows()->pluck('following_id')->toArray() : [];

        $data = $following->through(function ($user) use ($authFollowingIds, $authUser) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'username' => $user->username,
                'avatar' => $user->avatar,
                'bio' => $user->bio,
                'role' => $user->role,
                'is_verified' => $user->kyc_status === 'verified' || $user->hasActiveVerificationBadge(),
                'is_following' => in_array($user->id, $authFollowingIds, true),
                'is_self' => $authUser && $authUser->id === $user->id,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $data,
        ]);
    }
}
