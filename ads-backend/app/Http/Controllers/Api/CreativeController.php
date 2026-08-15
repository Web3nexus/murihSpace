<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Creative;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class CreativeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        if (!$advertiserId) {
            return response()->json(['message' => 'Advertiser ID missing'], 400);
        }

        $creatives = Creative::where('advertiser_id', $advertiserId)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($creatives);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $advertiserId = $request->header('X-Advertiser-ID');
        if (!$advertiserId) {
            return response()->json(['message' => 'Advertiser ID missing'], 400);
        }

        $request->validate([
            'file' => 'required|file|max:50000', // max 50MB
        ]);

        if (!$request->hasFile('file')) {
            return response()->json(['message' => 'No file uploaded'], 400);
        }

        $file = $request->file('file');
        
        // Determine type
        $mime = $file->getMimeType();
        $type = str_starts_with($mime, 'video/') ? 'video' : 'single_image';

        try {
            // Push to s3 disk (or fallback to local if s3 is not properly configured)
            // Using 'public' visibility so it can be read without presigned URLs if needed
            $path = Storage::disk('s3')->putFile('creatives', $file, 'public');
            
            // Generate full URL
            $url = Storage::disk('s3')->url($path);
        } catch (\Exception $e) {
            Log::error("S3 Upload Failed: " . $e->getMessage());
            // Fallback to local storage for local testing if S3 fails
            $path = Storage::disk('public')->putFile('creatives', $file);
            $url = Storage::disk('public')->url($path);
        }

        $creative = Creative::create([
            'advertiser_id' => $advertiserId,
            'type' => $type,
            'status' => 'pending',
            'assets' => [
                'url' => $url,
                'path' => $path,
                'mime_type' => $mime,
                'size' => $file->getSize(),
                'original_name' => $file->getClientOriginalName()
            ]
        ]);

        return response()->json($creative, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $creative = Creative::findOrFail($id);
        return response()->json($creative);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $creative = Creative::findOrFail($id);
        
        try {
            $path = $creative->assets['path'] ?? null;
            if ($path) {
                // Try S3 first, fallback local
                if (Storage::disk('s3')->exists($path)) {
                    Storage::disk('s3')->delete($path);
                } elseif (Storage::disk('public')->exists($path)) {
                    Storage::disk('public')->delete($path);
                }
            }
        } catch (\Exception $e) {
            Log::error("Delete Failed: " . $e->getMessage());
        }

        $creative->delete();
        return response()->json(['message' => 'Creative deleted successfully']);
    }
}
