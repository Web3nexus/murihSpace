<?php

namespace App\Services;

use App\Models\HelpArticle;
use App\Models\HelpArticleRelation;
use App\Models\HelpArticleRevision;
use App\Models\StaffUser;
use Illuminate\Support\Str;

class HelpContentService
{
    /**
     * Article states (draft → review → scheduled/published → archived).
     */
    public const STATES = [
        'draft',
        'review',
        'scheduled',
        'published',
        'archived',
    ];

    /**
     * Create an article plus its initial revision.
     */
    public function create(array $data, StaffUser $author, ?string $note = null): HelpArticle
    {
        $article = HelpArticle::create($this->payload($data) + ['state' => 'draft']);

        $this->snapshot($article, $author, $note ?? 'Created');
        $this->syncRelated($article, $data['related'] ?? []);

        return $article;
    }

    /**
     * Update an article, always snapshotting the previous version first so the
     * last published state is never lost (recoverable revision).
     */
    public function update(HelpArticle $article, array $data, StaffUser $author, ?string $note = null): HelpArticle
    {
        $this->snapshot($article, $author, $note ?? 'Updated');

        $article->update($this->payload(['ignore_slug' => $article->id] + $data));
        $this->syncRelated($article, $data['related'] ?? []);

        return $article;
    }

    /**
     * Persist a full-content snapshot of the article as the next revision.
     */
    public function snapshot(HelpArticle $article, StaffUser $author, ?string $note = null): HelpArticleRevision
    {
        $next = (int) $article->revisions()->max('revision_number') + 1;

        return HelpArticleRevision::create([
            'article_id' => $article->id,
            'revision_number' => $next,
            'title' => $article->title,
            'excerpt' => $article->excerpt,
            'body' => $article->body,
            'sections' => $article->sections,
            'keywords' => $article->keywords,
            'tags' => $article->tags,
            'seo_title' => $article->seo_title,
            'seo_description' => $article->seo_description,
            'canonical_url' => $article->canonical_url,
            'created_by_type' => StaffUser::class,
            'created_by_id' => $author->id,
            'note' => $note,
        ]);
    }

    /**
     * Restore an article's content from a revision. The current state is
     * snapshotted first so the restore itself is reversible.
     */
    public function restoreRevision(HelpArticle $article, HelpArticleRevision $revision, StaffUser $author): HelpArticle
    {
        $this->snapshot($article, $author, "Restored revision #{$revision->revision_number}");

        $article->update([
            'title' => $revision->title,
            'excerpt' => $revision->excerpt,
            'body' => $revision->body,
            'sections' => $revision->sections,
            'keywords' => $revision->keywords,
            'tags' => $revision->tags,
            'seo_title' => $revision->seo_title,
            'seo_description' => $revision->seo_description,
            'canonical_url' => $revision->canonical_url,
        ]);

        return $article;
    }

    /**
     * Transition an article to a new state with correct timestamp bookkeeping.
     */
    public function transition(HelpArticle $article, string $state): HelpArticle
    {
        if (! in_array($state, self::STATES, true)) {
            throw new \InvalidArgumentException("Unknown article state: {$state}");
        }

        $payload = ['state' => $state];

        match ($state) {
            'published' => $payload += ['published_at' => now(), 'scheduled_at' => null, 'archived_at' => null],
            'scheduled' => $payload += ['scheduled_at' => now(), 'published_at' => null, 'archived_at' => null],
            'archived' => $payload += ['archived_at' => now(), 'scheduled_at' => null],
            'draft', 'review' => $payload += ['scheduled_at' => null, 'archived_at' => null],
            default => null,
        };

        $article->update($payload);

        return $article;
    }

    /**
     * Schedule an article to be published at a specific time.
     */
    public function schedule(HelpArticle $article, string $at): HelpArticle
    {
        $article->update([
            'state' => 'scheduled',
            'scheduled_at' => $at,
            'published_at' => null,
            'archived_at' => null,
        ]);

        return $article;
    }

    /**
     * Build the article attribute payload from validated form data.
     */
    protected function payload(array $data): array
    {
        return [
            'category_id' => $data['category_id'] ?? null,
            'slug' => $this->uniqueSlug(
                $data['slug'] ?? null,
                $data['title'],
                $data['ignore_slug'] ?? null,
            ),
            'title' => $data['title'],
            'excerpt' => $data['excerpt'] ?? null,
            'body' => $data['body'] ?? '',
            'sections' => $data['sections'] ?? null,
            'keywords' => $data['keywords'] ?? null,
            'tags' => $data['tags'] ?? null,
            'featured' => (bool) ($data['featured'] ?? false),
            'seo_title' => $data['seo_title'] ?? null,
            'seo_description' => $data['seo_description'] ?? null,
            'canonical_url' => $data['canonical_url'] ?? null,
        ];
    }

    /**
     * Replace an article's related-article set.
     */
    protected function syncRelated(HelpArticle $article, array $relatedIds): void
    {
        HelpArticleRelation::where('article_id', $article->id)->delete();

        $ids = collect($relatedIds)
            ->filter(fn ($id) => (int) $id !== $article->id && is_numeric($id))
            ->unique()
            ->values();

        foreach ($ids as $index => $id) {
            HelpArticleRelation::create([
                'article_id' => $article->id,
                'related_article_id' => (int) $id,
                'sort_order' => $index,
            ]);
        }
    }

    /**
     * Generate a unique slug, falling back to a title-derived slug and appending
     * a counter when the base slug is already taken.
     */
    protected function uniqueSlug(?string $slug, string $title, mixed $ignoreId = null): string
    {
        $base = Str::slug($slug !== null && $slug !== '' ? $slug : $title);

        if ($base === '') {
            $base = Str::lower(Str::random(8));
        }

        $candidate = $base;
        $counter = 2;

        while (
            HelpArticle::query()
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
