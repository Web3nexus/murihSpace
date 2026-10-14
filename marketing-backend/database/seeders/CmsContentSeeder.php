<?php

namespace Database\Seeders;

use App\Models\CmsContent;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CmsContentSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the marketing CMS with default published content mirroring the
     * frontend's original hardcoded sections. Idempotent per (section, slug).
     */
    public function run(): void
    {
        $this->seedSection('homepage', 'homepage', [
            'badge' => 'Built for creators, by creators',
            'headline' => 'Connect, teach, and monetize',
            'headline_accent' => 'with verified trust and escrow',
            'subcopy' => 'MurihSpace combines private messaging, live audio stages, student cohorts, and instant storefronts — all protected and simple to use.',
            'primary_cta_label' => 'Sign in',
            'primary_cta_href' => '/login',
            'secondary_cta_label' => 'Download App',
            'secondary_cta_href' => '/download',
            'creators_badge' => '2,400+ creators joined this month',
            'hero_image_url' => '/images/hero-woman.webp',
            'multilingual_headline' => 'Connect, teach, and transact with absolute confidence across structured cohorts and storefronts.',
            'multilingual_image_url' => '/images/creatorEve.webp',
            'calls_headline' => 'Interactive live audio rooms and HD stage masterclasses',
            'calls_subcopy' => 'From group masterclasses with your core cohort to 1-on-1 coaching calls, feel like you are in the same room with crystal-clear audio and video.',
            'calls_image_url' => '/images/creatorEvent.png',
            'security_headline' => 'Default Signal protocol encryption & KYC verified trust',
            'security_subcopy' => 'Your personal messages, audio calls, media, and private cohorts are cryptographically locked. Full moderation controls, KYC verification, and dispute resolution built in.',
            'security_image_url' => '/images/creator.png',
            'groups_headline' => 'Organize student cohorts, paid memberships & discussion channels',
            'groups_subcopy' => 'Whether hosting an exclusive cohort, running live polls, or coordinating member events, group conversations feel effortless on MurihSpace.',
            'groups_image_url' => '/images/creatorEve.webp',
            'status_headline' => 'Murih AI creator studio, 24h stories & expressiveness',
            'status_subcopy' => 'Outline curriculum, draft community broadcasts, publish ephemeral stories, and generate course lessons with your integrated AI copilot.',
            'status_image_url' => '/images/creatorEvent.png',
            'business_headline' => 'Monetize digital downloads, physical goods & coaching with escrow',
            'business_subcopy' => 'Sell digital downloads, memberships, coaching, and physical merchandise directly to your audience with automated milestone escrow protection.',
            'business_image_url' => '/images/creatorEvent.png',
            'download_image_url' => '/images/creatorEve.webp',
        ]);

        foreach ([
            ['value' => '12K+', 'label' => 'Active creators'],
            ['value' => '340K+', 'label' => 'Community members'],
            ['value' => '$2.8M', 'label' => 'Paid out to creators'],
            ['value' => '99.9%', 'label' => 'Platform uptime'],
        ] as $i => $stat) {
            $this->seedSection('stats', 'stat-'.($i + 1), $stat, $stat['label'], sortOrder: $i);
        }

        foreach ([
            ['title' => 'Communities & Cohorts', 'description' => 'Launch public or private cohorts with channels, member roles, announcements, and group discussions.', 'icon' => 'Users', 'gradient' => 'from-blue-500/20 to-cyan-500/20', 'icon_color' => 'text-[#2164B6]', 'image_url' => '/images/creatorEve.webp'],
            ['title' => 'Creator Storefront', 'description' => 'Sell digital products, courses, coaching, and merch directly to your audience with milestone escrow.', 'icon' => 'Store', 'gradient' => 'from-purple-500/20 to-pink-500/20', 'icon_color' => 'text-[#2164B6]', 'image_url' => '/images/creatorEvent.png'],
            ['title' => 'Private Messaging & Audio', 'description' => 'Real-time Signal-encrypted chat with your supporters. 1-on-1 direct messages, voice notes, and 24-hour Stories.', 'icon' => 'MessageSquare', 'gradient' => 'from-blue-500/20 to-sky-500/20', 'icon_color' => 'text-[#2164B6]', 'image_url' => '/images/creator.png'],
            ['title' => 'Live Calling & Stages', 'description' => 'Host HD group video calls, live audio stages with speaker queues, and interactive workshops with screen sharing.', 'icon' => 'Phone', 'gradient' => 'from-amber-500/20 to-orange-500/20', 'icon_color' => 'text-[#2164B6]', 'image_url' => '/images/creatorEvent.png'],
            ['title' => 'KYC Trust & Escrow', 'description' => 'Verified creator badges, end-to-end encryption by default, anti-fraud escrow, and full moderation controls.', 'icon' => 'ShieldCheck', 'gradient' => 'from-rose-500/20 to-red-500/20', 'icon_color' => 'text-[#2164B6]', 'image_url' => '/images/creator.png'],
            ['title' => 'Creator Studio & AI', 'description' => 'Murih AI copilot, curriculum generator, broadcast drafts, and real-time revenue analytics.', 'icon' => 'Sparkles', 'gradient' => 'from-indigo-500/20 to-violet-500/20', 'icon_color' => 'text-[#2164B6]', 'image_url' => '/images/creatorEve.webp'],
        ] as $i => $feature) {
            $this->seedSection('features', 'feature-'.($i + 1), $feature, $feature['title'], sortOrder: $i);
        }

        foreach ([
            ['quote' => 'MurihSpace changed how I connect with my audience. I\'ve built a real community that actually pays for my work.', 'author' => 'Amara O.', 'role' => 'Digital creator, 45K followers'],
            ['quote' => 'The storefront alone saved me thousands in platform fees. And my fans love buying directly from me.', 'author' => 'James K.', 'role' => 'Course creator & coach'],
            ['quote' => 'I tried five platforms before MurihSpace. This is the first one that actually feels like it was built for creators like me.', 'author' => 'Liam C.', 'role' => 'Photographer & educator'],
        ] as $i => $testimonial) {
            $this->seedSection('testimonials', 'testimonial-'.($i + 1), $testimonial, $testimonial['author'], sortOrder: $i);
        }

        foreach ([
            ['name' => 'Starter', 'price' => 'Free', 'period' => null, 'description' => 'Perfect for getting started', 'features' => ['Basic community access', 'Public profile', 'Up to 100 members', 'Basic analytics'], 'cta' => 'Get started', 'popular' => false],
            ['name' => 'Creator', 'price' => '$12', 'period' => '/month', 'description' => 'For serious creators', 'features' => ['Everything in Starter', 'Custom storefront', 'Unlimited members', 'Sell digital products', 'Real-time messaging', 'AI-powered insights', 'Priority support'], 'cta' => 'Start creating', 'popular' => true],
            ['name' => 'Vendor', 'price' => '$29', 'period' => '/month', 'description' => 'For growing businesses', 'features' => ['Everything in Creator', 'Physical product sales', 'Shipping & fulfilment', 'Team management', 'Advanced analytics', 'Custom domain', 'API access'], 'cta' => 'Go Pro', 'popular' => false],
        ] as $i => $plan) {
            $this->seedSection('pricing', 'plan-'.($i + 1), $plan, $plan['name'], sortOrder: $i);
        }

        $this->seedSection('cta', 'cta', [
            'headline' => 'Ready to build your',
            'headline_accent' => 'creator empire',
            'subcopy' => 'Join thousands of creators already using MurihSpace. Start free, no credit card required.',
            'primary_cta_label' => 'Download the app',
            'primary_cta_href' => '/download',
            'secondary_cta_label' => 'Sign in',
            'secondary_cta_href' => '/login',
            'fine_print' => 'Free forever. No credit card needed.',
        ]);

        $this->seedSection('seo', 'defaults', [
            'default_title' => 'MurihSpace — The Creator Platform',
            'default_description' => 'Build, grow, and monetise your community. All in one place.',
            'og_image' => null,
        ]);

        foreach ([
            ['label' => 'Features', 'href' => '/features'],
            ['label' => 'Pricing', 'href' => '/pricing'],
            ['label' => 'Creators', 'href' => '/creators'],
            ['label' => 'Blog', 'href' => '/blog'],
            ['label' => 'Help', 'href' => '/help'],
        ] as $i => $link) {
            $this->seedSection('navigation', 'nav-'.($i + 1), $link, $link['label'], sortOrder: $i);
        }

        foreach ([
            ['label' => 'Privacy', 'href' => '/privacy'],
            ['label' => 'Terms', 'href' => '/terms'],
        ] as $i => $link) {
            $this->seedSection('footer', 'footer-'.($i + 1), $link, $link['label'], sortOrder: $i);
        }

        // Registration was retired in favour of the mobile app, so existing
        // installs must pick up the sign-in/app CTAs. Merge only those keys so
        // any other admin-edited copy and the publication state are preserved.
        $this->mergeContent('homepage', 'homepage', [
            'primary_cta_label' => 'Sign in',
            'primary_cta_href' => '/login',
        ]);
        $this->mergeContent('cta', 'cta', [
            'primary_cta_label' => 'Download the app',
            'primary_cta_href' => '/download',
            'secondary_cta_label' => 'Sign in',
            'secondary_cta_href' => '/login',
        ]);
    }

    /**
     * Merge a subset of keys into an existing row's JSON content, leaving any
     * other admin-edited fields and the publication state untouched. The merge
     * only runs while the row still points at the retired `/register` CTA, so a
     * CTA an admin has since customised is never overwritten on re-seed.
     *
     * @param  array<string, mixed>  $overrides
     */
    protected function mergeContent(string $section, string $slug, array $overrides): void
    {
        $row = CmsContent::where('section', $section)->where('slug', $slug)->first();

        if (! $row) {
            return;
        }

        $content = $row->content ?? [];

        // Only rewrite CTAs that still point at the retired /register page.
        // Check every href the override touches so the `cta` row is upgraded
        // even when only its secondary link held the register URL.
        $hrefKeys = array_filter(
            array_keys($overrides),
            static fn (string $key): bool => str_ends_with($key, '_href')
        );

        $isStale = false;
        foreach ($hrefKeys as $key) {
            if (($content[$key] ?? null) === '/register') {
                $isStale = true;
                break;
            }
        }

        if (! $isStale) {
            return;
        }

        $row->content = array_merge($content, $overrides);
        $row->save();
    }

    /**
     * Seed or update a single content item.
     */
    protected function seedSection(string $section, string $slug, array $content, ?string $title = null, int $sortOrder = 0): void
    {
        // Create only when missing so re-seeding never overwrites CMS content
        // that admins have edited or its publication state.
        CmsContent::firstOrCreate(
            ['section' => $section, 'slug' => $slug],
            [
                'title' => $title ?? $content['name'] ?? null,
                'content' => $content,
                'state' => 'published',
                'sort_order' => $sortOrder,
                'published_at' => now(),
            ]
        );
    }
}
