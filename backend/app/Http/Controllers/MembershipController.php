<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MembershipController extends Controller
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}
    /**
     * Join a community (instant for public, pending for private).
     */
    public function join(Request $request, int $communityId): JsonResponse
    {
        $user = $request->user();
        $community = Community::findOrFail($communityId);

        // Check if user is the creator
        if ($community->user_id === $user->id) {
            return response()->json([
                'message' => 'You are the creator of this community.',
            ], 400);
        }

        // Check existing membership
        $existing = CommunityMembership::where('community_id', $communityId)
            ->where('user_id', $user->id)
            ->first();

        if ($existing) {
            if ($existing->status === 'active') {
                return response()->json(['message' => 'You are already a member of this community.', 'membership' => $existing]);
            }
            if ($existing->status === 'pending') {
                return response()->json(['message' => 'Your join request is pending approval.', 'membership' => $existing]);
            }
        }

        // If community is paid, verify and charge payment
        if ($community->pricing_type === 'paid' && (float) ($community->price_amount ?? 0) > 0) {
            $coinCost = (int) $community->price_amount;
            $wallet = $user->wallet;
            $currentCoins = (int) ($wallet?->coin_balance ?? 0);

            if ($currentCoins < $coinCost) {
                return response()->json([
                    'message' => "Insufficient coin balance. You need {$coinCost} coins to join this community (your balance: {$currentCoins} coins).",
                    'code' => 'INSUFFICIENT_FUNDS',
                    'required_coins' => $coinCost,
                    'current_coins' => $currentCoins,
                ], 402);
            }

            // Deduct coins from user and credit creator
            \Illuminate\Support\Facades\DB::transaction(function () use ($user, $wallet, $coinCost, $community) {
                if ($wallet) {
                    $wallet->decrement('coin_balance', $coinCost);
                }

                $creator = User::find($community->user_id);
                $creatorWallet = $creator?->wallet;
                if ($creatorWallet) {
                    $creatorWallet->increment('coin_balance', $coinCost);
                }

                // Notify creator of paid subscription
                try {
                    $creator?->notify(new \App\Notifications\MurihOfficialNotification(
                        type: 'money_received',
                        title: '💎 New Community Subscriber!',
                        body: "@{$user->username} subscribed to your community {$community->name} (+{$coinCost} coins)!",
                        actionUrl: NotificationService::link('app/communities/' . $community->slug),
                        actionLabel: 'View Community',
                        route: '/communities/' . $community->slug,
                        metadata: [
                            'community_id' => $community->id,
                            'subscriber_id' => $user->id,
                            'coins' => $coinCost,
                        ]
                    ));
                } catch (\Throwable $e) {
                    report($e);
                }
            });
        }

        // Determine status based on community visibility
        $status = ($community->visibility === 'public' || $community->pricing_type === 'paid') ? 'active' : 'pending';

        $membership = CommunityMembership::updateOrCreate(
            ['community_id' => $communityId, 'user_id' => $user->id],
            [
                'role' => 'member',
                'status' => $status,
            ]
        );

        // Increment members count if active
        if ($status === 'active') {
            $community->increment('members_count');
        }

        if ($status === 'pending') {
            try {
                $creator = User::find($community->user_id);
                if ($creator) {
                    $this->notifications->actionEmail(
                        user: $creator,
                        title: $user->name.' wants to join '.$community->name,
                        bodyHtml: '<p>Hi '.e($creator->name).',</p><p><strong>'.e($user->name).'</strong> has requested to join your community <strong>'.e($community->name).'</strong>. Review the request to approve or reject it.</p>',
                        actionLabel: 'Review join requests',
                        actionUrl: NotificationService::link('app/requests'),
                        template: 'community_join_request',
                        data: [
                            'from_name' => e($user->name),
                            'community' => e($community->name),
                        ],
                    );
                }
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json([
            'message' => $status === 'active'
                ? 'Successfully joined the community!'
                : 'Your join request has been submitted to the creator for approval.',
            'status' => $status,
            'membership' => $membership,
        ]);
    }

    /**
     * Remove a member from a community (Creator/Admin only).
     */
    public function removeMember(Request $request, int $communityId, int $userId): JsonResponse
    {
        $community = Community::findOrFail($communityId);

        if ($community->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only the community owner can remove members.'], 403);
        }

        $membership = CommunityMembership::where('community_id', $communityId)
            ->where('user_id', $userId)
            ->first();

        if (! $membership) {
            return response()->json(['message' => 'Member not found.'], 404);
        }

        if ($membership->status === 'active' && $community->members_count > 1) {
            $community->decrement('members_count');
        }

        $membership->delete();

        return response()->json(['message' => 'Member removed successfully.']);
    }

    /**
     * Update a member's role (member | moderator | admin) (Creator only).
     */
    public function updateMemberRole(Request $request, int $communityId, int $userId): JsonResponse
    {
        $community = Community::findOrFail($communityId);

        if ($community->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'role' => ['required', 'string', 'in:member,moderator,admin'],
        ]);

        $membership = CommunityMembership::where('community_id', $communityId)
            ->where('user_id', $userId)
            ->firstOrFail();

        $membership->update(['role' => $validated['role']]);

        return response()->json([
            'message' => 'Member role updated successfully.',
            'membership' => $membership,
        ]);
    }

    /**
     * Leave a community.
     */
    public function leave(Request $request, int $communityId): JsonResponse
    {
        $user = $request->user();
        $community = Community::findOrFail($communityId);

        if ($community->user_id === $user->id) {
            return response()->json([
                'message' => 'Creators cannot leave their own community.',
            ], 400);
        }

        $membership = CommunityMembership::where('community_id', $communityId)
            ->where('user_id', $user->id)
            ->first();

        if (! $membership) {
            return response()->json([
                'message' => 'You are not a member of this community.',
            ], 404);
        }

        if ($membership->status === 'active' && $community->members_count > 1) {
            $community->decrement('members_count');
        }

        $membership->delete();

        return response()->json([
            'message' => 'Successfully left the community.',
        ]);
    }

    /**
     * Check membership status for current user.
     */
    public function status(Request $request, int $communityId): JsonResponse
    {
        $user = $request->user();
        $membership = CommunityMembership::where('community_id', $communityId)
            ->where('user_id', $user->id)
            ->first();

        return response()->json([
            'is_member' => $membership && $membership->status === 'active',
            'is_pending' => $membership && $membership->status === 'pending',
            'role' => $membership ? $membership->role : null,
            'status' => $membership ? $membership->status : 'none',
        ]);
    }

    /**
     * List members of a community.
     */
    public function members(int $communityId): JsonResponse
    {
        $memberships = CommunityMembership::with('user:id,name,username,avatar,bio')
            ->where('community_id', $communityId)
            ->activeOnly()
            ->latest()
            ->paginate(30);

        return response()->json($memberships);
    }

    /**
     * List pending join requests for a community (Creator only).
     */
    public function pendingRequests(Request $request, int $communityId): JsonResponse
    {
        $community = Community::findOrFail($communityId);

        if ($community->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only the creator can review join requests.'], 403);
        }

        $requests = CommunityMembership::with('user:id,name,username,avatar,bio')
            ->where('community_id', $communityId)
            ->pendingOnly()
            ->latest()
            ->get();

        return response()->json(['requests' => $requests, 'data' => $requests]);
    }

    /**
     * Approve a pending join request (Creator only).
     */
    public function approve(Request $request, int $membershipId): JsonResponse
    {
        $membership = CommunityMembership::with('community')->findOrFail($membershipId);

        if ($membership->community->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $membership->update(['status' => 'active']);
        $membership->community->increment('members_count');

        try {
            $member = User::find($membership->user_id);
            if ($member) {
                $this->notifications->actionEmail(
                    user: $member,
                    title: 'You have been accepted into '.$membership->community->name,
                    bodyHtml: '<p>Your request to join <strong>'.e($membership->community->name).'</strong> has been <strong>approved</strong>. Welcome aboard!</p>',
                    actionLabel: 'Visit community',
                    actionUrl: NotificationService::link('app/communities/'.$membership->community->slug),
                    template: 'community_join_approved',
                    data: ['community' => e($membership->community->name)],
                );

                // Official In-App Notification with verified Blue Badge
                $member->notify(new \App\Notifications\MurihOfficialNotification(
                    type: 'join_approved',
                    title: '🎉 Welcome to ' . $membership->community->name . '!',
                    body: "Your request to join {$membership->community->name} has been approved by the creator. Tap to enter the community.",
                    actionUrl: NotificationService::link('app/communities/' . $membership->community->slug),
                    actionLabel: 'Open Community',
                    route: '/communities/' . $membership->community->slug,
                    metadata: ['community_id' => $membership->community->id]
                ));
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => 'Join request approved successfully.',
            'membership' => $membership,
        ]);
    }

    /**
     * Reject a pending join request (Creator only).
     */
    public function reject(Request $request, int $membershipId): JsonResponse
    {
        $membership = CommunityMembership::with('community')->findOrFail($membershipId);

        if ($membership->community->user_id !== $request->user()->id && ! $request->user()->isAdmin()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $membership->update(['status' => 'rejected']);

        try {
            $member = User::find($membership->user_id);
            if ($member) {
                $this->notifications->actionEmail(
                    user: $member,
                    title: 'Your request to join '.$membership->community->name.' was declined',
                    bodyHtml: '<p>Thank you for your interest in <strong>'.e($membership->community->name).'</strong>. Unfortunately, your join request was <strong>not approved</strong> at this time.</p>',
                    template: 'community_join_rejected',
                    data: ['community' => e($membership->community->name)],
                );
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => 'Join request rejected.',
        ]);
    }

    /**
     * List the authenticated user's own community membership requests.
     */
    public function myRequests(Request $request): JsonResponse
    {
        $requests = CommunityMembership::with('community:id,name,slug,logo_url,members_count,visibility')
            ->where('user_id', $request->user()->id)
            ->whereIn('status', ['pending', 'active', 'rejected'])
            ->latest()
            ->get();

        return response()->json([
            'data' => $requests->map(fn ($m) => [
                'id' => $m->id,
                'community' => $m->community,
                'status' => $m->status,
                'role' => $m->role,
                'created_at' => $m->created_at,
            ]),
        ]);
    }

    /**
     * Cancel (delete) a pending join request from the current user.
     */
    public function cancelRequest(Request $request, int $membershipId): JsonResponse
    {
        $membership = CommunityMembership::where('id', $membershipId)
            ->where('user_id', $request->user()->id)
            ->where('status', 'pending')
            ->first();

        if (! $membership) {
            return response()->json(['message' => 'Pending request not found.'], 404);
        }

        $membership->delete();

        return response()->json(['message' => 'Join request cancelled.']);
    }

    /**
     * List pending join requests across all communities the user owns
     * (used by the dashboard sidebar to review requests).
     */
    public function incomingRequests(Request $request): JsonResponse
    {
        $requests = CommunityMembership::with('community:id,name,slug,logo_url,members_count,visibility')
            ->with('user:id,name,username,avatar,bio')
            ->whereHas('community', function ($q) use ($request) {
                $q->where('user_id', $request->user()->id);
            })
            ->where('status', 'pending')
            ->latest()
            ->get();

        return response()->json([
            'data' => $requests->map(fn (CommunityMembership $m) => [
                'id' => $m->id,
                'community' => $m->community,
                'user' => $m->user,
                'role' => $m->role,
                'status' => $m->status,
                'created_at' => $m->created_at,
            ]),
        ]);
    }
}
