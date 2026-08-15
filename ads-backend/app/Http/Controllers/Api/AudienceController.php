<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Audience;
use App\Models\AudienceUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AudienceController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        if (!$advertiserId) {
            return response()->json(['message' => 'Missing X-Advertiser-ID header'], 400);
        }

        $audiences = Audience::where('advertiser_id', $advertiserId)
            ->withCount('users as computed_size')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($audience) {
                // If it's a custom list, use the computed size instead of the cached one to be safe
                if ($audience->type === 'custom_list') {
                    $audience->size = $audience->computed_size;
                }
                unset($audience->computed_size);
                return $audience;
            });

        return response()->json($audiences);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        if (!$advertiserId) {
            return response()->json(['message' => 'Missing X-Advertiser-ID header'], 400);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => ['required', Rule::in(['custom_list', 'lookalike', 'website_traffic'])],
            'source_audience_id' => 'nullable|exists:audiences,id',
            'rules' => 'nullable|array'
        ]);

        $validated['advertiser_id'] = $advertiserId;
        
        // If it's a lookalike or website_traffic, we can mark it as processing or ready based on async logic.
        // For simplicity, we just mark it as ready here.
        $validated['status'] = 'ready';

        $audience = Audience::create($validated);

        return response()->json($audience, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id, Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $audience = Audience::where('advertiser_id', $advertiserId)->findOrFail($id);

        return response()->json($audience);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $audience = Audience::where('advertiser_id', $advertiserId)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'rules' => 'sometimes|array'
        ]);

        $audience->update($validated);

        return response()->json($audience);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id, Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $audience = Audience::where('advertiser_id', $advertiserId)->findOrFail($id);
        
        $audience->delete();

        return response()->json(null, 204);
    }

    /**
     * Upload an array of user identifiers to populate a custom list.
     */
    public function uploadUsers(Request $request, string $id)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $audience = Audience::where('advertiser_id', $advertiserId)->where('type', 'custom_list')->findOrFail($id);

        $validated = $request->validate([
            'users' => 'required|array',
            'users.*' => 'required|string',
        ]);

        $usersToInsert = [];
        $now = now();
        foreach (array_unique($validated['users']) as $identifier) {
            $usersToInsert[] = [
                'audience_id' => $audience->id,
                'user_identifier' => $identifier,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        // Chunk inserts to avoid query size limits
        DB::transaction(function () use ($usersToInsert) {
            foreach (array_chunk($usersToInsert, 1000) as $chunk) {
                // Using insertOrIgnore to prevent duplicate entries from crashing the request
                AudienceUser::insertOrIgnore($chunk);
            }
        });

        // Update size
        $audience->size = AudienceUser::where('audience_id', $audience->id)->count();
        $audience->save();

        return response()->json([
            'message' => 'Users uploaded successfully',
            'size' => $audience->size
        ]);
    }
}
