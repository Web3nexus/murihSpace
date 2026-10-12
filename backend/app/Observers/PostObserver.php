<?php

namespace App\Observers;

use App\Models\Post;
use App\Services\HashtagService;

/**
 * Keeps hashtag tracking in sync with post lifecycle without every write path
 * having to remember to call the service.
 */
class PostObserver
{
    public function __construct(private readonly HashtagService $hashtags) {}

    /**
     * Normalise the hashtags attribute (merge explicit tags with any #tags in
     * the body) before the row is written, so the column and the tracker agree.
     */
    public function saving(Post $post): void
    {
        if (! $this->hashtags->tablesReady()) {
            return;
        }

        $normalised = $this->hashtags->tagsForStorage($post->content, $post->hashtags);

        if (! empty($normalised) || ! empty($post->hashtags)) {
            $post->hashtags = $normalised ?: null;
        }
    }

    public function created(Post $post): void
    {
        $this->hashtags->recordPost($post);
    }

    public function updated(Post $post): void
    {
        if (! $post->wasChanged('hashtags') && ! $post->wasChanged('is_draft') && ! $post->wasChanged('privacy')) {
            return;
        }

        // Remove the previously-counted set (the post's created_at anchor means
        // the daily bucket being corrected is the same one it was added to).
        if (! (bool) $post->getOriginal('is_draft') && $post->getOriginal('privacy') !== 'private') {
            $original = $post->getOriginal('hashtags');
            $this->hashtags->forgetTags($post, is_array($original) ? $original : []);
        }

        $this->hashtags->recordPost($post);
    }

    public function deleted(Post $post): void
    {
        if ($post->is_draft || $post->privacy === 'private') {
            return;
        }

        $this->hashtags->forgetTags($post, $post->hashtags);
    }
}
