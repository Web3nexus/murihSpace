<?php

namespace App\Http\Controllers;

use App\Models\Group;
use App\Models\GroupSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GroupSettingsController extends Controller
{
    /**
     * Show group settings (Admin/Owner only).
     */
    public function show(Request $request, Group $group): JsonResponse
    {
        $userId = $request->user()->id;
        if (!$group->isAdminOrOwner($userId)) {
            return response()->json(['error' => 'Unauthorized. Admin privileges required.'], 403);
        }

        $settings = GroupSetting::firstOrCreate(
            ['group_id' => $group->id],
            [
                'post_approval' => false,
                'who_can_post' => 'all_members',
                'who_can_chat' => 'all_members',
                'who_can_invite' => 'all_members',
                'slow_mode_seconds' => 0,
            ]
        );

        return response()->json([
            'success' => true,
            'data' => $settings,
        ]);
    }

    /**
     * Update group settings.
     */
    public function update(Request $request, Group $group): JsonResponse
    {
        $userId = $request->user()->id;
        if (!$group->isAdminOrOwner($userId)) {
            return response()->json(['error' => 'Unauthorized. Admin privileges required.'], 403);
        }

        $validated = $request->validate([
            'post_approval' => 'sometimes|boolean',
            'who_can_post' => ['sometimes', Rule::in(['all_members', 'admins_only'])],
            'who_can_chat' => ['sometimes', Rule::in(['all_members', 'admins_only'])],
            'who_can_invite' => ['sometimes', Rule::in(['all_members', 'admins_only'])],
            'slow_mode_seconds' => 'sometimes|integer|min:0|max:3600',
            'blocked_keywords' => 'nullable|array',
        ]);

        $settings = GroupSetting::updateOrCreate(
            ['group_id' => $group->id],
            $validated
        );

        return response()->json([
            'success' => true,
            'message' => 'Group settings updated successfully.',
            'data' => $settings,
        ]);
    }
}
