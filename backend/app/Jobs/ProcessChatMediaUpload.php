<?php

namespace App\Jobs;

use App\Models\Media;
use App\Models\Message;
use App\Models\Community;
use App\Services\StorageQuotaService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProcessChatMediaUpload implements ShouldQueue
{
    use Queueable;

    private string $tmpDir;

    public function __construct(
        public Message $message,
        public Media $media,
        public ?Community $community = null,
    ) {}

    public function handle(StorageQuotaService $quota): void
    {
        $this->tmpDir = storage_path('app/tmp/chat-media-processing');

        try {
            $this->message->update(['media_status' => Message::MEDIA_STATUS_PROCESSING]);

            $disk = Storage::disk($this->media->disk);
            if (! $disk->exists($this->media->path)) {
                $this->failWith('File not found on storage after upload.');
                return;
            }

            $local = $this->downloadToTemp($disk);
            if (! $local) {
                $this->failWith('Failed to download file for processing.');
                return;
            }

            if (str_starts_with($this->media->mime_type, 'image/')) {
                $info = @getimagesize($local);
                if ($info) {
                    $this->media->update([
                        'metadata' => array_merge($this->media->metadata ?? [], [
                            'width' => $info[0],
                            'height' => $info[1],
                        ]),
                    ]);
                }
            }

            $this->cleanTemp($local);

            $mediaType = $quota->classifyMimeType($this->media->mime_type);

            \Illuminate\Support\Facades\DB::transaction(function () use ($quota, $mediaType) {
                $this->media->incrementReferenceCount();
                $this->message->update([
                    'media_id' => $this->media->id,
                    'media_status' => Message::MEDIA_STATUS_READY,
                    'status' => Message::STATUS_SENT,
                    'attachment_url' => $this->media->url,
                ]);

                $quota->addUsage('user', $this->message->user_id, $mediaType, $this->media->size_bytes);

                if ($this->community) {
                    $quota->addUsage('community', $this->community->id, $mediaType, $this->media->size_bytes);
                }

                app(\App\Services\MediaRetentionService::class)->markAvailable($this->media);
            });
        } catch (\Throwable $e) {
            $this->failWith('Processing failed: ' . $e->getMessage());
        }
    }

    private function failWith(string $reason): void
    {
        $this->message->update([
            'media_status' => Message::MEDIA_STATUS_FAILED,
            'status' => Message::STATUS_FAILED,
        ]);
    }

    private function downloadToTemp($disk): ?string
    {
        if (! is_dir($this->tmpDir)) {
            mkdir($this->tmpDir, 0755, true);
        }

        $tmpPath = $this->tmpDir . '/' . Str::random(40) . '.' . pathinfo($this->media->filename, PATHINFO_EXTENSION);

        try {
            $content = $disk->get($this->media->path);
            if ($content === null) return null;
            file_put_contents($tmpPath, $content);
            return $tmpPath;
        } catch (\Throwable) {
            return null;
        }
    }

    private function cleanTemp(string $path): void
    {
        if (file_exists($path)) @unlink($path);
    }
}
