<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityMembership;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MembershipController extends Controller
{
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

        // Determine status based on community visibility
        $status = ($community->visibility === 'public') ? 'active' : 'pending';

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

        return response()->json([
            'message' => $status === 'active'
                ? 'Successfully joined the community!'
                : 'Your join request has been submitted to the creator for approval.',
            'status' => $status,
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
        $memberships = CommunityMembership::with('user:id,name,username,avatar')
            ->where('community_id', $communityId)
            ->activeOnly()
            ->latest()
            ->paginate(20);

        return response()->json($memberships);
    }

    /**
     * List pending join requests for a community (Creator only).
     */
    public function pendingRequests(Request $request, int $communityId): JsonResponse
    {
        $community = Community::findOrFail($communityId);

        if ($community->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized. Only the creator can review join requests.'], 403);
        }

        $requests = CommunityMembership::with('user:id,name,username,avatar,bio')
            ->where('community_id', $communityId)
            ->pendingOnly()
            ->latest()
            ->get();

        return response()->json(['requests' => $requests]);
    }

    /**
     * Approve a pending join request (Creator only).
     */
    public function approve(Request $request, int $membershipId): JsonResponse
    {
        $membership = CommunityMembership::with('community')->findOrFail($membershipId);

        if ($membership->community->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $membership->update(['status' => 'active']);
        $membership->community->increment('members_count');

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

        if ($membership->community->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $membership->update(['status' => 'rejected']);

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
