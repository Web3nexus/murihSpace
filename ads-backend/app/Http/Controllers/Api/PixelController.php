<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Pixel;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PixelController extends Controller
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

        $pixels = Pixel::where('advertiser_id', $advertiserId)
            ->withCount('events')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($pixels);
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
        ]);

        $validated['advertiser_id'] = $advertiserId;

        $pixel = Pixel::create($validated);

        return response()->json($pixel, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id, Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $pixel = Pixel::where('advertiser_id', $advertiserId)->findOrFail($id);

        return response()->json($pixel);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $pixel = Pixel::where('advertiser_id', $advertiserId)->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
        ]);

        $pixel->update($validated);

        return response()->json($pixel);
    }

    /**
     * Remove the specified resource from storage.
     */
    /**
     * Display events for a specific pixel.
     */
    public function events(string $id, Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $pixel = Pixel::where('advertiser_id', $advertiserId)->findOrFail($id);
        
        $events = $pixel->events()->orderBy('created_at', 'desc')->paginate(50);
        return response()->json($events);
    }


    public function destroy(string $id, Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        $pixel = Pixel::where('advertiser_id', $advertiserId)->findOrFail($id);
        
        $pixel->delete();

        return response()->json(null, 204);
    }
}
