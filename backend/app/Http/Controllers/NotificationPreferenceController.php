<?php

namespace App\Http\Controllers;

use App\Models\NotificationPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class NotificationPreferenceController extends Controller
{
    private function defaultPreferences(int $userId): array
    {
        $prefs = [];
        foreach (NotificationPreference::TYPES as $type) {
            foreach (NotificationPreference::CHANNELS as $channel) {
                $prefs[] = [
                    'user_id' => $userId,
                    'type' => $type,
                    'channel' => $channel,
                    'enabled' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        return $prefs;
    }

    /**
     * Get the authenticated user's notification preferences.
     * Boots defaults for any missing combinations.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->user()->id;

        // Ensure defaults exist
        $existing = NotificationPreference::where('user_id', $userId)->get();
        $existingKeys = $existing->map(fn ($p) => "{$p->type}_{$p->channel}")->toArray();

        $inserts = [];
        foreach (NotificationPreference::TYPES as $type) {
            foreach (NotificationPreference::CHANNELS as $channel) {
                if (! in_array("{$type}_{$channel}", $existingKeys)) {
                    $inserts[] = [
                        'user_id' => $userId,
                        'type' => $type,
                        'channel' => $channel,
                        'enabled' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                }
            }
        }

        if (! empty($inserts)) {
            NotificationPreference::insert($inserts);
        }

        $preferences = NotificationPreference::where('user_id', $userId)
            ->orderBy('type')
            ->orderBy('channel')
            ->get();

        // Group by type for clean frontend consumption
        $grouped = [];
        foreach ($preferences as $pref) {
            $grouped[$pref->type][$pref->channel] = $pref->enabled;
        }

        return response()->json([
            'data' => $grouped,
            'meta' => [
                'types' => NotificationPreference::TYPES,
                'channels' => NotificationPreference::CHANNELS,
            ],
        ]);
    }

    /**
     * Update one or many notification preferences.
     * Expects: [{ type, channel, enabled }]
     */
    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'preferences' => ['required', 'array', 'min:1', 'max:50'],
            'preferences.*.type' => ['required', Rule::in(NotificationPreference::TYPES)],
            'preferences.*.channel' => ['required', Rule::in(NotificationPreference::CHANNELS)],
            'preferences.*.enabled' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($validated, $request) {
            foreach ($validated['preferences'] as $pref) {
                NotificationPreference::updateOrCreate(
                    [
                        'user_id' => $request->user()->id,
                        'type' => $pref['type'],
                        'channel' => $pref['channel'],
                    ],
                    ['enabled' => $pref['enabled']],
                );
            }
        });

        return response()->json(['message' => 'Preferences updated.']);
    }
}
