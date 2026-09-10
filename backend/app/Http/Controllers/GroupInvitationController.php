<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Group;
use App\Models\GroupInvitation;
use App\Models\GroupMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class GroupInvitationController extends Controller
{
    /**
     * Send direct invitation to a specific user.
     */
    public function invite(Request $request, Group $group): JsonResponse
    {
        $user = $request->user();

        if (!$group->isMember($user->id)) {
            return response()->json(['error' => 'You must be a member to invite others.'], 403);
        }

        $settings = $group->settings;
        if ($settings && $settings->who_can_invite === 'admins_only' && !$group->isAdminOrOwner($user->id)) {
            return response()->json(['error' => 'Only admins can invite new members to this group.'], 403);
        }

        $validated = $request->validate([
            'user_id' => 'nullable|exists:users,id',
            'username' => 'nullable|string|exists:users,username',
        ]);

        $invitee = null;
        if (!empty($validated['user_id'])) {
            $invitee = User::findOrFail($validated['user_id']);
        } elseif (!empty($validated['username'])) {
            $invitee = User::where('username', $validated['username'])->firstOrFail();
        } else {
            return response()->json(['error' => 'Please provide a user ID or username.'], 422);
        }

        if ($group->isMember($invitee->id)) {
            return response()->json(['message' => 'User is already a member of this group.'], 400);
        }

        // Check for existing pending invitation
        $existing = GroupInvitation::where('group_id', $group->id)
            ->where('invitee_id', $invitee->id)
            ->where('status', 'pending')
            ->first();

        if ($existing) {
            return response()->json(['message' => 'An invitation is already pending for this user.'], 200);
        }

        $invitation = GroupInvitation::create([
            'group_id' => $group->id,
            'inviter_id' => $user->id,
            'invitee_id' => $invitee->id,
            'code' => Str::random(12),
            'status' => 'pending',
            'expires_at' => now()->addDays(7),
        ]);

        return response()->json([
            'success' => true,
            'message' => "Invitation sent to {$invitee->name}.",
            'data' => $invitation,
        ], 201);
    }

    /**
     * Get or create a reusable shareable invite link for this group.
     */
    public function getOrCreateInviteLink(Request $request, Group $group): JsonResponse
    {
        $user = $request->user();

        if (!$group->isMember($user->id)) {
            return response()->json(['error' => 'You must be a member to generate an invite link.'], 403);
        }

        $settings = $group->settings;
        if ($settings && $settings->who_can_invite === 'admins_only' && !$group->isAdminOrOwner($user->id)) {
            return response()->json(['error' => 'Only admins can generate invite links for this group.'], 403);
        }

        // Find existing general link (invitee_id is null)
        $link = GroupInvitation::where('group_id', $group->id)
            ->whereNull('invitee_id')
            ->where('status', 'pending')
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->first();

        if (!$link) {
            $link = GroupInvitation::create([
                'group_id' => $group->id,
                'inviter_id' => $user->id,
                'invitee_id' => null,
                'code' => Str::random(10),
                'status' => 'pending',
                'expires_at' => now()->addDays(30),
            ]);
        }

        return response()->json([
            'success' => true,
            'code' => $link->code,
            'invite_url' => url("/app/groups/join/{$link->code}"),
            'expires_at' => $link->expires_at,
        ]);
    }

    /**
     * Accept invitation by shareable invite code.
     */
    public function acceptByCode(Request $request, string $code): JsonResponse
    {
        $user = $request->user();

        $invitation = GroupInvitation::where('code', $code)->firstOrFail();

        if (!$invitation->isValid()) {
            return response()->json(['error' => 'This invite link has expired or reached its maximum uses.'], 410);
        }

        $group = $invitation->group;
        if (!$group) {
            return response()->json(['error' => 'Group no longer exists.'], 404);
        }

        if ($group->isMember($user->id)) {
            return response()->json([
                'success' => true,
                'message' => 'You are already a member of this group.',
                'group_slug' => $group->slug,
            ]);
        }

        DB::transaction(function () use ($group, $user, $invitation) {
            GroupMember::updateOrCreate(
                ['group_id' => $group->id, 'user_id' => $user->id],
                ['role' => 'member', 'status' => 'active', 'joined_at' => now()]
            );

            $group->increment('members_count');
            $invitation->increment('uses_count');

            if ($invitation->invitee_id === $user->id) {
                $invitation->update(['status' => 'accepted']);
            }

            // Sync with chat conversation
            $conv = Conversation::firstOrCreate(
                ['type' => 'group', 'group_id' => $group->id],
                ['title' => $group->name]
            );

            ConversationParticipant::firstOrCreate(
                ['conversation_id' => $conv->id, 'user_id' => $user->id],
                ['last_read_at' => now()]
            );
        });

        return response()->json([
            'success' => true,
            'message' => "Welcome to {$group->name}!",
            'group' => $group,
            'group_slug' => $group->slug,
        ]);
    }

    /**
     * Accept or decline a direct invitation by invitation ID.
     */
    public function respond(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'action' => ['required', Rule::in(['accept', 'decline'])],
        ]);

        $invitation = GroupInvitation::where('id', $id)
            ->where('invitee_id', $user->id)
            ->firstOrFail();

        if ($invitation->status !== 'pending') {
            return response()->json(['error' => 'This invitation has already been responded to.'], 400);
        }

        $group = $invitation->group;

        if ($validated['action'] === 'accept') {
            DB::transaction(function () use ($group, $user, $invitation) {
                $invitation->update(['status' => 'accepted']);

                GroupMember::updateOrCreate(
                    ['group_id' => $group->id, 'user_id' => $user->id],
                    ['role' => 'member', 'status' => 'active', 'joined_at' => now()]
                );

                $group->increment('members_count');

                $conv = Conversation::firstOrCreate(
                    ['type' => 'group', 'group_id' => $group->id],
                    ['title' => $group->name]
                );

                ConversationParticipant::firstOrCreate(
                    ['conversation_id' => $conv->id, 'user_id' => $user->id],
                    ['last_read_at' => now()]
                );
            });

            return response()->json([
                'success' => true,
                'message' => "You have joined {$group->name}!",
                'group_slug' => $group->slug,
            ]);
        } else {
            $invitation->update(['status' => 'declined']);
            return response()->json([
                'success' => true,
                'message' => 'Invitation declined.',
            ]);
        }
    }
}
