<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'platform_name' => config('app.name'),
                'maintenance_mode' => app()->isDownForMaintenance(),
                'registration_open' => !config('app.disable_registration'),
                'default_currency' => config('app.currency', 'USD'),
                'default_role' => 'member',
                'kyc_required_for' => ['creator', 'vendor'],
                'max_upload_size_mb' => 100,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'maintenance_mode' => ['sometimes', 'boolean'],
            'registration_open' => ['sometimes', 'boolean'],
            'default_currency' => ['sometimes', 'string', 'size:3'],
        ]);

        if (isset($validated['maintenance_mode'])) {
            $validated['maintenance_mode'] ? app()->down() : app()->up();
        }

        return response()->json(['message' => 'Settings updated.']);
    }
}
