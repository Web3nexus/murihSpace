<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MessageAttachmentController extends Controller
{
    public function upload(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimes:jpg,jpeg,png,gif,webp,pdf,doc,docx,txt,mp3,mp4,mov,zip,csv,xlsx,pptx'],
        ]);

        $file = $validated['file'];
        $mimeType = $file->getMimeType();
        $extension = $file->getClientOriginalExtension();
        $filename = Str::uuid() . '.' . $extension;

        $path = $file->storeAs('message_attachments', $filename, 'public');

        $attachmentType = match (true) {
            str_starts_with($mimeType, 'image/') => 'image',
            str_starts_with($mimeType, 'audio/') => 'voice',
            default => 'file',
        };

        $url = Storage::disk('public')->url($path);

        return response()->json([
            'data' => [
                'attachment_url' => $url,
                'attachment_type' => $attachmentType,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $mimeType,
                'size' => $file->getSize(),
            ],
        ], 201);
    }
}
