<?php

namespace App\Services;

use App\Models\Community;
use App\Models\StorageUsage;
use App\Models\User;
use Illuminate\Http\UploadedFile;

class StorageQuotaService
{
    public function checkCommunityQuota(Community $community, UploadedFile $file): ?string
    {
        $limit = $community->storage_limit_bytes;
        if ($limit === null) return null;

        $used = $this->getCommunityUsage($community);

        if (($used + $file->getSize()) > $limit) {
            return 'This community has reached its media storage limit.';
        }

        return null;
    }

    public function checkUserQuota(User $user, UploadedFile $file): ?string
    {
        $limit = $user->storage_limit_bytes ?? config('filesystems.max_user_storage_bytes');
        if ($limit === null) return null;

        $used = $this->getUserUsage($user);

        if (($used + $file->getSize()) > $limit) {
            return 'You have reached your media storage limit.';
        }

        return null;
    }

    public function getCommunityUsage(Community $community): int
    {
        return (int) StorageUsage::where('usable_type', 'community')
            ->where('usable_id', $community->id)
            ->sum('bytes');
    }

    public function getUserUsage(User $user): int
    {
        return (int) StorageUsage::where('usable_type', 'user')
            ->where('usable_id', $user->id)
            ->sum('bytes');
    }

    public function addUsage(string $usableType, int $usableId, string $mediaType, int $bytes): void
    {
        StorageUsage::upsert(
            [
                'usable_type' => $usableType,
                'usable_id' => $usableId,
                'media_type' => $mediaType,
                'bytes' => $bytes,
            ],
            ['usable_type', 'usable_id', 'media_type'],
            ['bytes' => \DB::raw("bytes + {$bytes}")],
        );
    }

    public function removeUsage(string $usableType, int $usableId, string $mediaType, int $bytes): void
    {
        $record = StorageUsage::where('usable_type', $usableType)
            ->where('usable_id', $usableId)
            ->where('media_type', $mediaType)
            ->first();

        if ($record) {
            $newBytes = max(0, $record->bytes - $bytes);
            if ($newBytes === 0) {
                $record->delete();
            } else {
                $record->update(['bytes' => $newBytes]);
            }
        }
    }

    public function classifyMimeType(string $mime): string
    {
        return match (true) {
            str_starts_with($mime, 'image/') => 'image',
            str_starts_with($mime, 'video/') => 'video',
            str_starts_with($mime, 'audio/') => 'voice',
            default => 'document',
        };
    }
}
