<?php

namespace App\Http\Controllers;

use App\Models\UserLocation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    /** Current sharing state for the signed-in user. */
    public function show(Request $request): JsonResponse
    {
        $location = UserLocation::firstWhere('user_id', $request->user()->id);

        return response()->json([
            'sharing_enabled' => (bool) ($location?->sharing_enabled ?? false),
            'has_location' => $location?->isShared() ?? false,
            'captured_at' => $location?->captured_at?->toIso8601String(),
        ]);
    }

    /** Turn sharing on or off. Turning it off clears any stored position. */
    public function updateSharing(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
        ]);

        $location = UserLocation::firstOrNew(['user_id' => $request->user()->id]);
        $location->sharing_enabled = $validated['enabled'];

        if (! $validated['enabled']) {
            $location->latitude = null;
            $location->longitude = null;
            $location->captured_at = null;
        }

        $location->save();

        return $this->show($request);
    }

    /** Store the user's position, rounded to about 1 km. Requires sharing to be on. */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
        ]);

        $location = UserLocation::firstWhere('user_id', $request->user()->id);
        if (! $location?->sharing_enabled) {
            return response()->json(['message' => 'Turn on location sharing first.'], 403);
        }

        $location->latitude = round((float) $validated['latitude'], 2);
        $location->longitude = round((float) $validated['longitude'], 2);
        $location->captured_at = now();
        $location->save();

        return $this->show($request);
    }

    /** Remove the stored position and turn sharing off. */
    public function destroy(Request $request): JsonResponse
    {
        UserLocation::where('user_id', $request->user()->id)->delete();

        return response()->json([
            'sharing_enabled' => false,
            'has_location' => false,
            'captured_at' => null,
        ]);
    }
}
