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
            'headline' => 'Your audience deserves',
            'headline_accent' => 'more than a link',
            'subcopy' => 'MurihSpace gives creators everything they need to build, grow, and monetise — communities, storefronts, messaging, and payments, all in one place.',
            'primary_cta_label' => 'Start building for free',
            'primary_cta_href' => '/register',
            'secondary_cta_label' => 'See creator stories',
            'secondary_cta_href' => '/creators',
            'creators_badge' => '2,400+ creators joined this month',
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
            ['title' => 'Communities', 'description' => 'Build private or public communities. Share updates, host discussions, and grow your tribe.', 'icon' => 'Users', 'gradient' => 'from-blue-500/20 to-cyan-500/20', 'icon_color' => 'text-blue-500'],
            ['title' => 'Storefront', 'description' => 'Sell digital products directly to your audience. No third-party fees, no hassle.', 'icon' => 'Store', 'gradient' => 'from-purple-500/20 to-pink-500/20', 'icon_color' => 'text-purple-500'],
            ['title' => 'Messaging', 'description' => 'Real-time chat with your community. Direct messages and channel conversations.', 'icon' => 'MessageSquare', 'gradient' => 'from-emerald-500/20 to-teal-500/20', 'icon_color' => 'text-emerald-500'],
            ['title' => 'Wallet & Payments', 'description' => 'Receive tips, donations, and payments. Withdraw when you want, where you want.', 'icon' => 'Wallet', 'gradient' => 'from-amber-500/20 to-orange-500/20', 'icon_color' => 'text-amber-500'],
            ['title' => 'Creator Safety', 'description' => 'Full moderation tools, KYC verification, and dispute resolution built in.', 'icon' => 'ShieldCheck', 'gradient' => 'from-rose-500/20 to-red-500/20', 'icon_color' => 'text-rose-500'],
            ['title' => 'AI Tools', 'description' => 'Smart analytics, automated moderation, and growth insights powered by AI.', 'icon' => 'Sparkles', 'gradient' => 'from-indigo-500/20 to-violet-500/20', 'icon_color' => 'text-indigo-500'],
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
            'primary_cta_label' => 'Create your free account',
            'primary_cta_href' => '/register',
            'secondary_cta_label' => 'See all features',
            'secondary_cta_href' => '/features',
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
    }

    /**
     * Seed a single content item if it does not already exist.
     */
    protected function seedSection(string $section, string $slug, array $content, ?string $title = null, int $sortOrder = 0): void
    {
        if (CmsContent::query()->where('section', $section)->where('slug', $slug)->exists()) {
            return;
        }

        CmsContent::create([
            'section' => $section,
            'slug' => $slug,
            'title' => $title ?? $content['name'] ?? null,
            'content' => $content,
            'state' => 'published',
            'sort_order' => $sortOrder,
            'published_at' => now(),
        ]);
    }
}
