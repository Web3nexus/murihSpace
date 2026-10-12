<?php

namespace App\Console\Commands;

use App\Models\Hashtag;
use App\Models\HashtagStat;
use App\Models\Post;
use App\Services\HashtagService;
use Illuminate\Console\Command;

class BackfillHashtags extends Command
{
    protected $signature = 'hashtags:backfill {--chunk=200 : Posts processed per batch}';

    protected $description = 'Rebuild hashtag tracking tables from existing published posts';

    public function handle(HashtagService $hashtags): int
    {
        if (! $hashtags->tablesReady()) {
            $this->error('Hashtag tracking tables are missing. Run migrations first.');

            return Command::FAILURE;
        }

        $this->info('Clearing existing hashtag data...');
        HashtagStat::query()->delete();
        Hashtag::query()->delete();

        $chunk = max(1, (int) $this->option('chunk'));
        $processed = 0;

        Post::query()
            ->where('is_draft', false)
            ->where('privacy', '!=', 'private')
            ->orderBy('id')
            ->chunkById($chunk, function ($posts) use ($hashtags, &$processed) {
                foreach ($posts as $post) {
                    $tags = $hashtags->tagsForStorage($post->content, $post->hashtags);
                    $post->hashtags = $tags ?: null;
                    $post->saveQuietly();
                    $hashtags->recordPost($post, $tags);
                    $processed++;
                }
            });

        $this->info("Backfilled hashtags from {$processed} posts.");

        return Command::SUCCESS;
    }
}
