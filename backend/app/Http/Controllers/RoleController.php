<?php

namespace App\Http\Controllers;

use App\Models\Community;
use App\Models\CommunityMembership;
use App\Models\CommunityRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class RoleController extends Controller
{
    /**
     * Return master list of all available community permissions.
     */
    public function permissionsMatrix(): JsonResponse
    {
        $permissions = [
            [
                'key' => 'create_posts',
                'name' => 'Create Posts & Updates',
                'description' => 'Publish posts, announcements and status updates.',
                'category' => 'Content',
                'default_for' => ['owner', 'admin', 'moderator', 'member'],
            ],
            [
                'key' => 'share_links',
                'name' => 'Share Clickable Links',
                'description' => 'Post URLs and external links in posts or comments. (Disabled for default members)',
                'category' => 'Content Security',
                'default_for' => ['owner', 'admin', 'moderator'],
            ],
            [
                'key' => 'moderate_content',
                'name' => 'Moderate Content & Comments',
                'description' => 'Delete or edit member posts and comments.',
                'category' => 'Moderation',
                'default_for' => ['owner', 'admin', 'moderator'],
            ],
            [
                'key' => 'manage_requests',
                'name' => 'Review Join Requests',
                'description' => 'Approve or reject private community applicants.',
                'category' => 'Moderation',
                'default_for' => ['owner', 'admin', 'moderator'],
            ],
            [
                'key' => 'manage_settings',
                'name' => 'Manage Community Settings',
                'description' => 'Edit space name, description, logo, cover and access rules.',
                'category' => 'Administration',
                'default_for' => ['owner', 'admin'],
            ],
            [
                'key' => 'manage_roles',
                'name' => 'Manage Roles & Assign Permissions',
                'description' => 'Create custom roles and assign permissions to members.',
                'category' => 'Administration',
                'default_for' => ['owner', 'admin'],
            ],
        ];

        return response()->json([
            'permissions' => $permissions,
        ]);
    }

    /**
     * List all roles for a community (System + Custom).
     */
    public function index(Request $request, int $communityId): JsonResponse
    {
        $roles = CommunityRole::where('community_id', $communityId)
            ->latest()
            ->get();

        // Seed default system roles if none exist for this community
        if ($roles->isEmpty()) {
            $roles = collect([
                CommunityRole::create([
                    'community_id' => $communityId,
                    'name' => 'Owner',
                    'slug' => 'owner',
                    'permissions' => ['*'],
                    'is_system' => true,
                    'color' => '#102840',
                ]),
                CommunityRole::create([
                    'community_id' => $communityId,
                    'name' => 'Administrator',
                    'slug' => 'admin',
                    'permissions' => ['create_posts', 'share_links', 'moderate_content', 'manage_requests', 'manage_settings', 'manage_roles'],
                    'is_system' => true,
                    'color' => '#38A8D8',
                ]),
                CommunityRole::create([
                    'community_id' => $communityId,
                    'name' => 'Moderator',
                    'slug' => 'moderator',
                    'permissions' => ['create_posts', 'share_links', 'moderate_content', 'manage_requests'],
                    'is_system' => true,
                    'color' => '#F59E0B',
                ]),
                CommunityRole::create([
                    'community_id' => $communityId,
                    'name' => 'Member',
                    'slug' => 'member',
                    'permissions' => ['create_posts'], // Note: share_links disabled by default for members per Sprint 7 spec
                    'is_system' => true,
                    'color' => '#667085',
                ]),
            ]);
        }

        return response()->json(['roles' => $roles]);
    }

    /**
     * Create a custom role for a community.
     */
    public function store(Request $request, int $communityId): JsonResponse
    {
        $community = Community::findOrFail($communityId);

        if ($community->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized. Only the owner can create roles.'], 403);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['string'],
            'color' => ['nullable', 'string', 'max:20'],
        ]);

        $slug = Str::slug($validated['name']);

        $role = CommunityRole::create([
            'community_id' => $communityId,
            'name' => $validated['name'],
            'slug' => $slug,
            'permissions' => $validated['permissions'],
            'is_system' => false,
            'color' => $validated['color'] ?? '#38A8D8',
        ]);

        return response()->json([
            'message' => 'Custom role created successfully.',
            'role' => $role,
        ], 201);
    }

    /**
     * Assign a role to a community membership with ownership protection.
     */
    public function assign(Request $request, int $membershipId): JsonResponse
    {
        $membership = CommunityMembership::with('community')->findOrFail($membershipId);
        $community = $membership->community;

        if ($community->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        // Ownership protection: Cannot demote the community owner
        if ($membership->user_id === $community->user_id) {
            return response()->json(['message' => 'Ownership cannot be removed or demoted.'], 400);
        }

        $validated = $request->validate([
            'role' => ['required', 'string', 'in:admin,moderator,member'],
            'role_id' => ['nullable', 'exists:community_roles,id'],
        ]);

        $membership->update([
            'role' => $validated['role'],
            'role_id' => $validated['role_id'] ?? null,
        ]);

        return response()->json([
            'message' => 'Role assigned successfully.',
            'membership' => $membership,
        ]);
    }
}
