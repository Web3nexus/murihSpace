<?php

namespace App\Console\Commands;

use App\Models\Hashtag;
use App\Models\HashtagStat;
use Illuminate\Console\Command;

class PruneHashtagStats extends Command
{
    protected $signature = 'hashtags:prune {--days=60 : Daily stat buckets older than this are deleted}';

    protected $description = 'Prune old hashtag daily stats and abandoned hashtags';

    public function handle(): int
    {
        $days = max(1, (int) $this->option('days'));
        $cutoff = now()->subDays($days)->toDateString();

        $removed = HashtagStat::query()->where('date', '<', $cutoff)->delete();

        $abandoned = Hashtag::query()
            ->where('posts_count', '<=', 0)
            ->where(function ($q) use ($cutoff) {
                $q->whereNull('last_used_at')->orWhere('last_used_at', '<', $cutoff);
            })
            ->delete();

        $this->info("Pruned {$removed} stat rows and {$abandoned} abandoned hashtags.");

        return Command::SUCCESS;
    }
}
