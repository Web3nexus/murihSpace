<?php

namespace App\Http\Controllers;

use App\Models\Conversation;
use App\Models\ConversationParticipant;
use App\Models\Group;
use App\Models\GroupInvitation;
use App\Models\GroupJoinRequest;
use App\Models\GroupMember;
use App\Models\GroupSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class GroupController extends Controller
{
    /**
     * Discover groups with search, category filtering, and membership state.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()?->id;
        $search = trim((string) $request->query('search', ''));
        $category = $request->query('category');
        $driver = DB::connection()->getDriverName();
        $like = $driver === 'pgsql' ? 'ilike' : 'like';

        $query = Group::with(['creator:id,name,username,avatar'])
            ->where('discoverability', 'discoverable')
            ->whereNull('deleted_at');

        if ($category && $category !== 'All') {
            $query->where('category', $category);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search, $like) {
                $q->where('name', $like, "%{$search}%")
                    ->orWhere('description', $like, "%{$search}%")
                    ->orWhere('slug', $like, "%{$search}%");
            });
        }

        $groups = $query->orderBy('members_count', 'desc')
            ->latest()
            ->paginate(18);

        // Attach membership status for authenticated user
        if ($userId) {
            $groupIds = $groups->pluck('id');
            $memberships = GroupMember::whereIn('group_id', $groupIds)
                ->where('user_id', $userId)
                ->get()
                ->keyBy('group_id');

            $joinRequests = GroupJoinRequest::whereIn('group_id', $groupIds)
                ->where('user_id', $userId)
                ->where('status', 'pending')
                ->get()
                ->keyBy('group_id');

            $groups->getCollection()->transform(function ($group) use ($memberships, $joinRequests) {
                $mem = $memberships->get($group->id);
                $group->is_member = $mem && $mem->status === 'active';
                $group->user_role = $mem ? $mem->role : null;
                $group->has_pending_request = isset($joinRequests[$group->id]);
                return $group;
            });
        }

        return response()->json([
            'success' => true,
            'data' => $groups,
            'groups' => $groups->items(),
        ]);
    }

    /**
     * List user's joined and owned groups.
     */
    public function mine(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $groups = Group::whereHas('members', function ($q) use ($userId) {
            $q->where('user_id', $userId)->where('status', 'active');
        })
            ->with(['creator:id,name,username,avatar'])
            ->latest('updated_at')
            ->get();

        $memberships = GroupMember::whereIn('group_id', $groups->pluck('id'))
            ->where('user_id', $userId)
            ->get()
            ->keyBy('group_id');

        $groups->transform(function ($group) use ($memberships) {
            $mem = $memberships->get($group->id);
            $group->is_member = true;
            $group->user_role = $mem ? $mem->role : null;
            return $group;
        });

        return response()->json([
            'success' => true,
            'data' => $groups->values(),
        ]);
    }

    /**
     * List pending group invitations for the authenticated user.
     */
    public function invitations(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $invites = GroupInvitation::where('invitee_id', $userId)
            ->where('status', 'pending')
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->with([
                'group:id,name,slug,description,avatar_url,category,privacy,members_count',
                'inviter:id,name,username,avatar',
            ])
            ->latest()
            ->get();

        return response()->json([
            'success' => true,
            'data' => $invites->values(),
        ]);
    }

    /**
     * Create a new group.
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:2000',
            'category' => 'nullable|string|max:50',
            'privacy' => ['required', Rule::in(['public', 'private', 'invite_only'])],
            'discoverability' => ['nullable', Rule::in(['discoverable', 'hidden'])],
            'avatar_url' => 'nullable|url|max:500',
            'cover_url' => 'nullable|url|max:500',
            'rules' => 'nullable|string|max:5000',
            'tags' => 'nullable|array',
            'website' => 'nullable|url|max:255',
            'location' => 'nullable|string|max:100',
        ]);

        $baseSlug = Str::slug($validated['name']);
        if (!$baseSlug) {
            $baseSlug = 'group-' . Str::random(6);
        }

        $slug = $baseSlug;
        $count = 1;
        while (Group::where('slug', $slug)->exists()) {
            $slug = "{$baseSlug}-{$count}";
            $count++;
        }

        $group = DB::transaction(function () use ($user, $validated, $slug) {
            $group = Group::create([
                'name' => $validated['name'],
                'slug' => $slug,
                'description' => $validated['description'] ?? null,
                'category' => $validated['category'] ?? 'General',
                'privacy' => $validated['privacy'],
                'discoverability' => $validated['discoverability'] ?? ($validated['privacy'] === 'invite_only' ? 'hidden' : 'discoverable'),
                'avatar_url' => $validated['avatar_url'] ?? null,
                'cover_url' => $validated['cover_url'] ?? null,
                'rules' => $validated['rules'] ?? null,
                'tags' => $validated['tags'] ?? [],
                'website' => $validated['website'] ?? null,
                'location' => $validated['location'] ?? null,
                'creator_id' => $user->id,
                'members_count' => 1,
                'posts_count' => 0,
            ]);

            // Add creator as owner
            GroupMember::create([
                'group_id' => $group->id,
                'user_id' => $user->id,
                'role' => 'owner',
                'status' => 'active',
                'joined_at' => now(),
            ]);

            // Default group settings
            GroupSetting::create([
                'group_id' => $group->id,
                'post_approval' => false,
                'who_can_post' => 'all_members',
                'who_can_chat' => 'all_members',
                'who_can_invite' => 'all_members',
                'slow_mode_seconds' => 0,
            ]);

            // Create group conversation for real-time chat
            $conversation = Conversation::create([
                'type' => 'group',
                'group_id' => $group->id,
                'title' => $group->name,
            ]);

            ConversationParticipant::create([
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
                'last_read_at' => now(),
            ]);

            return $group;
        });

        $group->load(['creator:id,name,username,avatar', 'settings']);
        $group->is_member = true;
        $group->user_role = 'owner';

        return response()->json([
            'success' => true,
            'message' => 'Group created successfully.',
            'data' => $group,
        ], 201);
    }

    /**
     * Show group details and caller's permissions.
     */
    public function show(Request $request, string $slug): JsonResponse
    {
        $userId = $request->user()?->id;

        $group = Group::where('slug', $slug)
            ->orWhere('id', is_numeric($slug) ? (int)$slug : 0)
            ->with(['creator:id,name,username,avatar', 'settings'])
            ->firstOrFail();

        $membership = $userId ? $group->membership($userId) : null;
        $isMember = $membership && $membership->status === 'active';
        $userRole = $membership ? $membership->role : null;
        $isAdminOrOwner = $group->isAdminOrOwner($userId);

        $hasPendingRequest = false;
        if ($userId && !$isMember) {
            $hasPendingRequest = GroupJoinRequest::where('group_id', $group->id)
                ->where('user_id', $userId)
                ->where('status', 'pending')
                ->exists();
        }

        $group->is_member = $isMember;
        $group->user_role = $userRole;
        $group->is_admin_or_owner = $isAdminOrOwner;
        $group->has_pending_request = $hasPendingRequest;
        $group->can_post = $group->canPost($userId);
        $group->can_chat = $group->canChat($userId);

        // Include conversation ID for chat tab
        $conversation = Conversation::firstOrCreate(
            ['type' => 'group', 'group_id' => $group->id],
            ['title' => $group->name]
        );
        $group->conversation_id = $conversation->id;

        return response()->json([
            'success' => true,
            'data' => $group,
        ]);
    }

    /**
     * Update group details (Admin/Owner only).
     */
    public function update(Request $request, Group $group): JsonResponse
    {
        $userId = $request->user()->id;
        if (!$group->isAdminOrOwner($userId)) {
            return response()->json(['error' => 'Unauthorized. Admin privileges required.'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:2000',
            'category' => 'sometimes|string|max:50',
            'privacy' => ['sometimes', Rule::in(['public', 'private', 'invite_only'])],
            'discoverability' => ['sometimes', Rule::in(['discoverable', 'hidden'])],
            'avatar_url' => 'nullable|url|max:500',
            'cover_url' => 'nullable|url|max:500',
            'rules' => 'nullable|string|max:5000',
            'tags' => 'nullable|array',
            'website' => 'nullable|url|max:255',
            'location' => 'nullable|string|max:100',
        ]);

        $group->update($validated);

        // Update group conversation title if name changed
        if (isset($validated['name'])) {
            Conversation::where('type', 'group')->where('group_id', $group->id)->update(['title' => $validated['name']]);
        }

        return response()->json([
            'success' => true,
            'message' => 'Group updated successfully.',
            'data' => $group->fresh(['creator:id,name,username,avatar', 'settings']),
        ]);
    }

    /**
     * Delete group (Owner only).
     */
    public function destroy(Request $request, Group $group): JsonResponse
    {
        $userId = $request->user()->id;
        if ((int)$group->creator_id !== (int)$userId) {
            return response()->json(['error' => 'Only the group owner can delete this group.'], 403);
        }

        $group->delete();

        return response()->json([
            'success' => true,
            'message' => 'Group deleted successfully.',
        ]);
    }

    /**
     * Join group or submit a join request.
     */
    public function join(Request $request, Group $group): JsonResponse
    {
        $user = $request->user();

        // Check if already active
        $existing = GroupMember::where('group_id', $group->id)
            ->where('user_id', $user->id)
            ->first();

        if ($existing && $existing->status === 'active') {
            return response()->json(['message' => 'You are already a member of this group.'], 400);
        }

        if ($existing && $existing->status === 'banned') {
            return response()->json(['error' => 'You have been banned from this group.'], 403);
        }

        // Public group: join immediately
        if ($group->privacy === 'public') {
            DB::transaction(function () use ($group, $user, $existing) {
                if ($existing) {
                    $existing->update(['status' => 'active', 'joined_at' => now()]);
                } else {
                    GroupMember::create([
                        'group_id' => $group->id,
                        'user_id' => $user->id,
                        'role' => 'member',
                        'status' => 'active',
                        'joined_at' => now(),
                    ]);
                }

                $group->increment('members_count');

                // Sync with conversation
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
                'status' => 'joined',
                'message' => 'You have joined the group.',
            ]);
        }

        // Private group: create or return pending join request
        $joinReq = GroupJoinRequest::firstOrCreate(
            ['group_id' => $group->id, 'user_id' => $user->id],
            ['status' => 'pending', 'note' => $request->input('note')]
        );

        if ($joinReq->status === 'rejected') {
            $joinReq->update(['status' => 'pending', 'note' => $request->input('note')]);
        }

        return response()->json([
            'success' => true,
            'status' => 'pending_approval',
            'message' => 'Join request submitted. An admin will review your request.',
        ]);
    }

    /**
     * Leave group.
     */
    public function leave(Request $request, Group $group): JsonResponse
    {
        $userId = $request->user()->id;

        if ((int)$group->creator_id === (int)$userId) {
            // Check if there are other members that can take ownership or warn
            $otherAdmins = GroupMember::where('group_id', $group->id)
                ->where('user_id', '!=', $userId)
                ->where('status', 'active')
                ->where('role', 'admin')
                ->exists();

            if (!$otherAdmins) {
                return response()->json([
                    'error' => 'As the group owner, you must assign another admin before leaving or delete the group.',
                ], 422);
            }
        }

        DB::transaction(function () use ($group, $userId) {
            GroupMember::where('group_id', $group->id)
                ->where('user_id', $userId)
                ->delete();

            $group->decrement('members_count');

            $conv = Conversation::where('type', 'group')->where('group_id', $group->id)->first();
            if ($conv) {
                ConversationParticipant::where('conversation_id', $conv->id)
                    ->where('user_id', $userId)
                    ->delete();
            }
        });

        return response()->json([
            'success' => true,
            'message' => 'You have left the group.',
        ]);
    }
}
