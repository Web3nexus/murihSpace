<?php

namespace App\Console\Commands;

use App\Models\Announcement;
use App\Models\CmsContent;
use App\Models\HelpArticle;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('support:publish-scheduled-help')]
#[Description('Publish scheduled help articles, CMS content and announcements whose scheduled_at has arrived.')]
class PublishScheduledHelp extends Command
{
    public function handle(): int
    {
        $helpCount = 0;
        HelpArticle::query()
            ->where('state', 'scheduled')
            ->where('scheduled_at', '<=', now())
            ->get()
            ->each(function ($article) use (&$helpCount) {
                $article->update([
                    'state' => 'published',
                    'published_at' => now(),
                    'scheduled_at' => null,
                ]);
                $helpCount++;
            });

        $cmsCount = 0;
        CmsContent::query()
            ->where('state', 'scheduled')
            ->where('scheduled_at', '<=', now())
            ->get()
            ->each(function ($cms) use (&$cmsCount) {
                $cms->update([
                    'state' => 'published',
                    'published_at' => now(),
                    'scheduled_at' => null,
                ]);
                $cmsCount++;
            });

        $announcementCount = 0;
        Announcement::query()
            ->where('state', 'scheduled')
            ->where('scheduled_at', '<=', now())
            ->get()
            ->each(function ($announcement) use (&$announcementCount) {
                $announcement->update([
                    'state' => 'published',
                    'published_at' => now(),
                    'scheduled_at' => null,
                ]);
                $announcementCount++;
            });

        $this->info("Published {$helpCount} scheduled help article(s), {$cmsCount} CMS item(s), {$announcementCount} announcement(s).");

        return self::SUCCESS;
    }
}
