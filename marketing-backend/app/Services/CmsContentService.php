<?php

namespace App\Services;

use App\Models\CmsContent;
use App\Models\CmsContentRevision;
use App\Models\StaffUser;
use Illuminate\Support\Str;

class CmsContentService
{
    public const STATES = ['draft', 'review', 'scheduled', 'published', 'archived'];

    /**
     * Create a content item in a section as a draft, with its initial revision.
     */
    public function create(string $section, array $data, StaffUser $author, ?string $note = null): CmsContent
    {
        $item = CmsContent::create($this->payload($section, $data) + ['state' => 'draft']);

        $this->snapshot($item, $author, $note ?? 'Created');

        return $item;
    }

    /**
     * Update a content item, snapshotting the previous version first so the
     * last published state is always recoverable.
     */
    public function update(CmsContent $item, array $data, StaffUser $author, ?string $note = null): CmsContent
    {
        $this->snapshot($item, $author, $note ?? 'Updated');

        $item->update($this->payload($item->section, ['ignore_slug' => $item->id] + $data));

        return $item;
    }

    /**
     * Persist a full-content snapshot as the next revision.
     */
    public function snapshot(CmsContent $item, StaffUser $author, ?string $note = null): CmsContentRevision
    {
        $next = (int) $item->revisions()->max('revision_number') + 1;

        return CmsContentRevision::create([
            'content_id' => $item->id,
            'revision_number' => $next,
            'title' => $item->title,
            'excerpt' => $item->excerpt,
            'body' => $item->body,
            'content' => $item->content,
            'seo_title' => $item->seo_title,
            'seo_description' => $item->seo_description,
            'created_by_type' => StaffUser::class,
            'created_by_id' => $author->id,
            'note' => $note,
        ]);
    }

    /**
     * Restore a content item from a revision. The current state is snapshotted
     * first so the restore itself is reversible.
     */
    public function restoreRevision(CmsContent $item, CmsContentRevision $revision, StaffUser $author): CmsContent
    {
        $this->snapshot($item, $author, "Restored revision #{$revision->revision_number}");

        $item->update([
            'title' => $revision->title,
            'excerpt' => $revision->excerpt,
            'body' => $revision->body,
            'content' => $revision->content,
            'seo_title' => $revision->seo_title,
            'seo_description' => $revision->seo_description,
        ]);

        return $item;
    }

    /**
     * Transition an item to a new state with correct timestamp bookkeeping.
     */
    public function transition(CmsContent $item, string $state): CmsContent
    {
        if (! in_array($state, self::STATES, true)) {
            throw new \InvalidArgumentException("Unknown CMS state: {$state}");
        }

        $payload = ['state' => $state];

        match ($state) {
            'published' => $payload += ['published_at' => now(), 'scheduled_at' => null, 'archived_at' => null],
            'scheduled' => $payload += ['scheduled_at' => now(), 'published_at' => null, 'archived_at' => null],
            'archived' => $payload += ['archived_at' => now(), 'scheduled_at' => null],
            'draft', 'review' => $payload += ['scheduled_at' => null, 'archived_at' => null],
            default => null,
        };

        $item->update($payload);

        return $item;
    }

    /**
     * Schedule an item to be published at a specific time.
     */
    public function schedule(CmsContent $item, string $at): CmsContent
    {
        $item->update([
            'state' => 'scheduled',
            'scheduled_at' => $at,
            'published_at' => null,
            'archived_at' => null,
        ]);

        return $item;
    }

    /**
     * Build the content attribute payload from validated form data.
     */
    protected function payload(string $section, array $data): array
    {
        return [
            'section' => $section,
            'slug' => $this->uniqueSlug(
                $section,
                $data['slug'] ?? null,
                $data['title'] ?? $data['content']['title'] ?? 'untitled',
                $data['ignore_slug'] ?? null,
            ),
            'title' => $data['title'] ?? null,
            'excerpt' => $data['excerpt'] ?? null,
            'body' => $data['body'] ?? '',
            'content' => $data['content'] ?? null,
            'sort_order' => (int) ($data['sort_order'] ?? 0),
            'seo_title' => $data['seo_title'] ?? null,
            'seo_description' => $data['seo_description'] ?? null,
        ];
    }

    /**
     * Generate a unique slug within a section, falling back to a derived slug
     * and appending a counter when the base slug is already taken.
     */
    protected function uniqueSlug(string $section, ?string $slug, string $fallbackTitle, mixed $ignoreId = null): string
    {
        $base = Str::slug($slug !== null && $slug !== '' ? $slug : $fallbackTitle);

        if ($base === '') {
            $base = Str::lower(Str::random(8));
        }

        $candidate = $base;
        $counter = 2;

        while (
            CmsContent::query()
                ->where('section', $section)
                ->where('slug', $candidate)
                ->when($ignoreId !== null, fn ($q) => $q->where('id', '!=', (int) $ignoreId))
                ->exists()
        ) {
            $candidate = "{$base}-{$counter}";
            $counter++;
        }

        return $candidate;
    }
}
