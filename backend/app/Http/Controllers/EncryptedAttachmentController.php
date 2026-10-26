<?php

namespace App\Http\Controllers;

use App\Models\ConversationParticipant;
use App\Models\EncryptedAttachment;
use App\Services\StorageQuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Client-side encrypted attachments.
 *
 * The client encrypts the file (AES-256-GCM, fresh key and nonce) before upload
 * and sends the key to the recipient over the Signal session. This controller
 * only ever sees ciphertext: it stores opaque bytes under a random object name
 * in a private bucket and hands out short-lived signed URLs to conversation
 * participants. No content-type or content scanning is possible here.
 */
class EncryptedAttachmentController extends Controller
{
    private const CONTENT_TYPE = 'application/octet-stream';

    public function __construct(private readonly StorageQuotaService $quota) {}

    public function store(Request $request): JsonResponse
    {
        $maxBytes = (int) config('encrypted_attachments.max_bytes');

        $validated = $request->validate([
            'conversation_id' => ['required', 'integer', 'exists:conversations,id'],
            // Size is in kilobytes for the 'max' rule.
            'file' => ['required', 'file', 'max:'.intdiv($maxBytes, 1024)],
        ]);

        $user = $request->user();
        $file = $request->file('file');

        if ($file->getSize() === false || $file->getSize() < 1) {
            return response()->json(['message' => 'Encrypted attachment is empty.'], 422);
        }

        $isParticipant = ConversationParticipant::where('conversation_id', $validated['conversation_id'])
            ->where('user_id', $user->id)
            ->exists();

        if (! $isParticipant) {
            return response()->json(['message' => 'You are not a participant of this conversation.'], 403);
        }

        $dailyLimit = (int) config('encrypted_attachments.daily_upload_limit');
        $uploadedToday = EncryptedAttachment::where('user_id', $user->id)
            ->where('created_at', '>=', now()->subDay())
            ->count();

        if ($uploadedToday >= $dailyLimit) {
            return response()->json(['message' => 'Daily encrypted attachment limit reached.'], 429);
        }

        $quotaError = $this->quota->checkUserQuota($user, $file);
        if ($quotaError !== null) {
            return response()->json(['message' => $quotaError], 403);
        }

        $disk = (string) config('encrypted_attachments.disk');
        if (! config("filesystems.disks.{$disk}")) {
            return response()->json(['message' => "Storage disk '{$disk}' not configured."], 500);
        }

        // Random object name: nothing about the file leaks through the key.
        $objectName = bin2hex(random_bytes(24));
        $path = Storage::disk($disk)->putFileAs(
            'encrypted_attachments',
            $file,
            $objectName,
            ['visibility' => 'private', 'ContentType' => self::CONTENT_TYPE],
        );

        if (! $path) {
            return response()->json(['message' => 'Failed to store encrypted attachment.'], 500);
        }

        try {
            $attachment = EncryptedAttachment::create([
                'user_id' => $user->id,
                'conversation_id' => $validated['conversation_id'],
                'disk' => $disk,
                'object_path' => $path,
                'size_bytes' => $file->getSize(),
                'content_type' => self::CONTENT_TYPE,
            ]);
        } catch (\Throwable $e) {
            Storage::disk($disk)->delete($path);
            throw $e;
        }

        return response()->json([
            'data' => [
                'id' => $attachment->id,
                'conversation_id' => $attachment->conversation_id,
                'size' => $attachment->size_bytes,
                'content_type' => $attachment->content_type,
                'created_at' => $attachment->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    public function url(Request $request, EncryptedAttachment $attachment): JsonResponse
    {
        // Non-participants get the same answer as a missing row, so attachment
        // ids cannot be probed.
        $isParticipant = ConversationParticipant::where('conversation_id', $attachment->conversation_id)
            ->where('user_id', $request->user()->id)
            ->exists();

        if (! $isParticipant) {
            return response()->json(['message' => 'Attachment not found.'], 404);
        }

        if (! Storage::disk($attachment->disk)->exists($attachment->object_path)) {
            return response()->json(['message' => 'Attachment not found.'], 404);
        }

        $expiresAt = now()->addMinutes((int) config('encrypted_attachments.url_ttl_minutes'));

        return response()->json([
            'data' => [
                'url' => Storage::disk($attachment->disk)->temporaryUrl($attachment->object_path, $expiresAt),
                'size' => $attachment->size_bytes,
                'content_type' => $attachment->content_type,
                'expires_at' => $expiresAt->toIso8601String(),
            ],
        ]);
    }
}
