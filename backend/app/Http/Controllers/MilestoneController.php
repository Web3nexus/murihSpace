<?php

namespace App\Http\Controllers;

use App\Models\Milestone;
use App\Models\UserMilestone;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MilestoneController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $milestones = Milestone::where('creator_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $milestones]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'metric_type' => ['required', 'in:followers,sales,revenue,products,engagement'],
            'target_value' => ['required', 'integer', 'min:1'],
            'reward_type' => ['nullable', 'in:badge,feature,custom'],
            'reward_data' => ['nullable', 'array'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);

        $validated['creator_id'] = $request->user()->id;

        $milestone = Milestone::create($validated);

        return response()->json(['data' => $milestone], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $milestone = Milestone::where('creator_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'metric_type' => ['sometimes', 'in:followers,sales,revenue,products,engagement'],
            'target_value' => ['sometimes', 'integer', 'min:1'],
            'reward_type' => ['nullable', 'in:badge,feature,custom'],
            'reward_data' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);

        $milestone->update($validated);

        return response()->json(['data' => $milestone->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $milestone = Milestone::where('creator_id', $request->user()->id)->findOrFail($id);
        $milestone->delete();

        return response()->json(['message' => 'Milestone deleted.']);
    }

    public function myProgress(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        $progress = UserMilestone::where('user_id', $userId)
            ->with('milestone')
            ->latest()
            ->get()
            ->map(fn ($um) => [
                'id' => $um->id,
                'milestone_id' => $um->milestone_id,
                'progress' => $um->progress,
                'target' => $um->milestone?->target_value,
                'achieved' => $um->isAchieved(),
                'achieved_at' => $um->achieved_at?->toIso8601String(),
                'milestone' => $um->milestone ? [
                    'id' => $um->milestone->id,
                    'title' => $um->milestone->title,
                    'description' => $um->milestone->description,
                    'metric_type' => $um->milestone->metric_type,
                    'reward_type' => $um->milestone->reward_type,
                    'reward_data' => $um->milestone->reward_data,
                ] : null,
            ]);

        return response()->json(['data' => $progress]);
    }

    public function updateProgress(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'milestone_id' => ['required', 'integer', 'exists:milestones,id'],
            'progress' => ['required', 'integer', 'min:0'],
        ]);

        $milestone = Milestone::findOrFail($validated['milestone_id']);
        $userId = $request->user()->id;

        $um = UserMilestone::updateOrCreate(
            ['user_id' => $userId, 'milestone_id' => $milestone->id],
            ['progress' => $validated['progress']],
        );

        if ($um->progress >= $milestone->target_value && ! $um->isAchieved()) {
            $um->update(['achieved_at' => now()]);
        }

        $um->load('milestone');

        return response()->json([
            'data' => [
                'id' => $um->id,
                'progress' => $um->progress,
                'target' => $milestone->target_value,
                'achieved' => $um->isAchieved(),
                'achieved_at' => $um->achieved_at?->toIso8601String(),
            ],
        ]);
    }

    public function publicMilestones(Request $request, int $creatorId): JsonResponse
    {
        $milestones = Milestone::where('creator_id', $creatorId)
            ->active()
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'title' => $m->title,
                'description' => $m->description,
                'metric_type' => $m->metric_type,
                'target_value' => $m->target_value,
                'reward_type' => $m->reward_type,
            ]);

        return response()->json(['data' => $milestones]);
    }
}
