<?php

namespace App\Console\Commands;

use App\Models\Post;
use App\Services\ActivityLogger;
use Illuminate\Console\Command;

class PublishScheduledContent extends Command
{
    protected $signature = 'content:publish-scheduled';
    protected $description = 'Publish posts whose scheduled_at time has passed';

    public function handle(ActivityLogger $logger): int
    {
        $now = now();
        $published = 0;

        Post::whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', $now)
            ->where('is_draft', true)
            ->chunk(100, function ($posts) use ($logger, &$published) {
                foreach ($posts as $post) {
                    $post->update([
                        'is_draft' => false,
                        'published_at' => now(),
                        'scheduled_at' => null,
                    ]);

                    $logger->publishedPost(
                        $post->author,
                        $post->community?->name ?? 'a community',
                        $post->id,
                    );

                    $published++;
                }
            });

        $this->info("Published {$published} scheduled posts.");

        return Command::SUCCESS;
    }
}
