<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\FeatureFlag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FeatureFlagController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => FeatureFlag::latest()->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'key' => ['required', 'string', 'max:100', 'unique:feature_flags,key', 'regex:/^[a-z0-9_]+$/'],
            'label' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'enabled' => ['nullable', 'boolean'],
        ]);

        $flag = FeatureFlag::create([
            'key' => $validated['key'],
            'label' => $validated['label'],
            'description' => $validated['description'] ?? null,
            'enabled' => $validated['enabled'] ?? false,
        ]);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'feature_flag.created',
            'resource_type' => 'feature_flag',
            'resource_id' => (string) $flag->id,
            'metadata' => ['key' => $flag->key],
        ]);

        return response()->json(['message' => 'Feature flag created.', 'data' => $flag], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $flag = FeatureFlag::findOrFail($id);

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'enabled' => ['nullable', 'boolean'],
            'is_scheduled' => ['nullable', 'boolean'],
            'scheduled_at' => ['nullable', 'date'],
        ]);

        $flag->update($validated);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'feature_flag.updated',
            'resource_type' => 'feature_flag',
            'resource_id' => (string) $flag->id,
            'metadata' => ['key' => $flag->key, 'enabled' => $flag->enabled],
        ]);

        return response()->json(['message' => 'Feature flag updated.', 'data' => $flag]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $flag = FeatureFlag::findOrFail($id);

        AuditLog::create([
            'user_id' => $request->user()->id,
            'action' => 'feature_flag.deleted',
            'resource_type' => 'feature_flag',
            'resource_id' => (string) $flag->id,
            'metadata' => ['key' => $flag->key],
        ]);

        $flag->delete();

        return response()->json(['message' => 'Feature flag deleted.']);
    }
}
