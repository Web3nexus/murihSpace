<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Group;
use App\Models\GroupJoinRequest;
use App\Models\GroupMember;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class GroupMemberController extends Controller
{
    /**
     * List members of a group with search and role filter.
     */
    public function index(Request $request, Group $group): JsonResponse
    {
        $userId = $request->user()?->id;
        $search = trim((string) $request->query('search', ''));
        $role = $request->query('role');
        $driver = DB::connection()->getDriverName();
        $like = $driver === 'pgsql' ? 'ilike' : 'like';

        $query = GroupMember::where('group_id', $group->id)
            ->where('status', 'active')
            ->with(['user:id,name,username,avatar']);

        if ($role && in_array($role, ['owner', 'admin', 'moderator', 'member'])) {
            $query->where('role', $role);
        }

        if ($search !== '') {
            $query->whereHas('user', function ($q) use ($search, $like) {
                $q->where('name', $like, "%{$search}%")
                    ->orWhere('username', $like, "%{$search}%");
            });
        }

        $members = $query->orderByRaw("CASE 
            WHEN role = 'owner' THEN 1 
            WHEN role = 'admin' THEN 2 
            WHEN role = 'moderator' THEN 3 
            ELSE 4 END")
            ->latest('joined_at')
            ->paginate(30);

        return response()->json([
            'success' => true,
            'data' => $members,
            'members' => $members->items(),
        ]);
    }

    /**
     * Change a member's role (Owner / Admin only).
     */
    public function updateRole(Request $request, Group $group, int $memberId): JsonResponse
    {
        $userId = $request->user()->id;
        if (!$group->isAdminOrOwner($userId)) {
            return response()->json(['error' => 'Unauthorized. Admin privileges required.'], 403);
        }

        $validated = $request->validate([
            'role' => ['required', Rule::in(['admin', 'moderator', 'member'])],
        ]);

        $targetMember = GroupMember::where('group_id', $group->id)->findOrFail($memberId);

        // Cannot modify owner
        if ($targetMember->role === 'owner' || (int)$group->creator_id === (int)$targetMember->user_id) {
            return response()->json(['error' => 'Group owner role cannot be modified.'], 422);
        }

        // Only owner can promote to admin or demote an admin
        if (($validated['role'] === 'admin' || $targetMember->role === 'admin') && !$group->isOwner($userId)) {
            return response()->json(['error' => 'Only the group owner can grant or revoke admin roles.'], 403);
        }

        $targetMember->update(['role' => $validated['role']]);

        return response()->json([
            'success' => true,
            'message' => "Member role updated to {$validated['role']}.",
            'data' => $targetMember->fresh('user:id,name,username,avatar'),
        ]);
    }

    /**
     * Mute or unmute a member (Admins and Mods).
     */
    public function mute(Request $request, Group $group, int $memberId): JsonResponse
    {
        $userId = $request->user()->id;
        if (!$group->isModeratorOrAbove($userId)) {
            return response()->json(['error' => 'Unauthorized. Moderator privileges required.'], 403);
        }

        $validated = $request->validate([
            'minutes' => 'nullable|integer|min:0|max:525600', // 0 or null = unmute
        ]);

        $targetMember = GroupMember::where('group_id', $group->id)->findOrFail($memberId);

        if ($targetMember->role === 'owner' || $targetMember->role === 'admin') {
            return response()->json(['error' => 'Admins cannot be muted.'], 422);
        }

        $minutes = $validated['minutes'] ?? 0;
        $mutedUntil = $minutes > 0 ? Carbon::now()->addMinutes($minutes) : null;

        $targetMember->update(['muted_until' => $mutedUntil]);

        return response()->json([
            'success' => true,
            'message' => $mutedUntil ? "Member muted for {$minutes} minutes." : 'Member unmuted.',
            'data' => $targetMember->fresh('user:id,name,username,avatar'),
        ]);
    }

    /**
     * Remove or ban a member from group.
     */
    public function remove(Request $request, Group $group, int $memberId): JsonResponse
    {
        $userId = $request->user()->id;
        if (!$group->isModeratorOrAbove($userId)) {
            return response()->json(['error' => 'Unauthorized. Moderator privileges required.'], 403);
        }

        $ban = $request->boolean('ban', false);
        $targetMember = GroupMember::where('group_id', $group->id)->findOrFail($memberId);

        if ($targetMember->role === 'owner' || (int)$group->creator_id === (int)$targetMember->user_id) {
            return response()->json(['error' => 'Group owner cannot be removed.'], 422);
        }

        if ($targetMember->role === 'admin' && !$group->isOwner($userId)) {
            return response()->json(['error' => 'Only the owner can remove an admin.'], 403);
        }

        DB::transaction(function () use ($group, $targetMember, $ban) {
            if ($ban) {
                $targetMember->update(['status' => 'banned']);
            } else {
                $targetMember->delete();
            }

            $group->decrement('members_count');

            $conv = Conversation::where('type', 'group')->where('group_id', $group->id)->first();
            if ($conv) {
                ConversationParticipant::where('conversation_id', $conv->id)
                    ->where('user_id', $targetMember->user_id)
                    ->delete();
            }
        });

        return response()->json([
            'success' => true,
            'message' => $ban ? 'Member banned from group.' : 'Member removed from group.',
        ]);
    }

    /**
     * List pending join requests (Admin/Mod only).
     */
    public function joinRequests(Request $request, Group $group): JsonResponse
    {
        $userId = $request->user()->id;
        if (!$group->isModeratorOrAbove($userId)) {
            return response()->json(['error' => 'Unauthorized. Moderator privileges required.'], 403);
        }

        $requests = GroupJoinRequest::where('group_id', $group->id)
            ->where('status', 'pending')
            ->with(['user:id,name,username,avatar'])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $requests,
        ]);
    }

    /**
     * Approve or reject a join request.
     */
    public function reviewJoinRequest(Request $request, Group $group, int $requestId): JsonResponse
    {
        $reviewer = $request->user();
        if (!$group->isModeratorOrAbove($reviewer->id)) {
            return response()->json(['error' => 'Unauthorized. Moderator privileges required.'], 403);
        }

        $validated = $request->validate([
            'action' => ['required', Rule::in(['approve', 'reject'])],
        ]);

        $joinReq = GroupJoinRequest::where('group_id', $group->id)->findOrFail($requestId);

        if ($joinReq->status !== 'pending') {
            return response()->json(['error' => 'This request has already been reviewed.'], 400);
        }

        DB::transaction(function () use ($group, $joinReq, $reviewer, $validated) {
            if ($validated['action'] === 'approve') {
                $joinReq->update([
                    'status' => 'approved',
                    'reviewed_by' => $reviewer->id,
                    'reviewed_at' => now(),
                ]);

                $member = GroupMember::updateOrCreate(
                    ['group_id' => $group->id, 'user_id' => $joinReq->user_id],
                    ['role' => 'member', 'status' => 'active', 'joined_at' => now()]
                );

                $group->increment('members_count');

                // Add to chat conversation
                $conv = Conversation::firstOrCreate(
                    ['type' => 'group', 'group_id' => $group->id],
                    ['title' => $group->name]
                );

                ConversationParticipant::firstOrCreate(
                    ['conversation_id' => $conv->id, 'user_id' => $joinReq->user_id],
                    ['last_read_at' => now()]
                );
            } else {
                $joinReq->update([
                    'status' => 'rejected',
                    'reviewed_by' => $reviewer->id,
                    'reviewed_at' => now(),
                ]);
            }
        });

        return response()->json([
            'success' => true,
            'message' => "Join request {$validated['action']}d successfully.",
        ]);
    }
}
