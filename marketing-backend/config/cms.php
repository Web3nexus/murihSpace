<?php

/*
|--------------------------------------------------------------------------
| Marketing CMS sections
|--------------------------------------------------------------------------
|
| Each section the "Website CMS" manages. A section can hold one content
| item (`single`) or many (`collection`). The `fields` describe the editable
| `content` JSON payload so the admin form and public API stay in sync.
|
*/

return [

    'sections' => [

        'homepage' => [
            'label' => 'Homepage',
            'icon' => 'home',
            'kind' => 'single',
            'fields' => [
                ['key' => 'badge', 'label' => 'Badge text', 'type' => 'text'],
                ['key' => 'headline', 'label' => 'Headline', 'type' => 'text'],
                ['key' => 'headline_accent', 'label' => 'Headline accent (gradient)', 'type' => 'text'],
                ['key' => 'subcopy', 'label' => 'Subcopy', 'type' => 'textarea'],
                ['key' => 'primary_cta_label', 'label' => 'Primary CTA label', 'type' => 'text'],
                ['key' => 'primary_cta_href', 'label' => 'Primary CTA link', 'type' => 'text'],
                ['key' => 'secondary_cta_label', 'label' => 'Secondary CTA label', 'type' => 'text'],
                ['key' => 'secondary_cta_href', 'label' => 'Secondary CTA link', 'type' => 'text'],
                ['key' => 'creators_badge', 'label' => 'Creators-joined badge', 'type' => 'text'],
            ],
        ],

        'stats' => [
            'label' => 'Stats band',
            'icon' => 'chart',
            'kind' => 'collection',
            'fields' => [
                ['key' => 'value', 'label' => 'Value', 'type' => 'text'],
                ['key' => 'label', 'label' => 'Label', 'type' => 'text'],
            ],
        ],

        'features' => [
            'label' => 'Features',
            'icon' => 'grid',
            'kind' => 'collection',
            'fields' => [
                ['key' => 'title', 'label' => 'Feature title', 'type' => 'text'],
                ['key' => 'description', 'label' => 'Description', 'type' => 'textarea'],
                ['key' => 'icon', 'label' => 'Icon key', 'type' => 'text'],
                ['key' => 'gradient', 'label' => 'Gradient classes', 'type' => 'text'],
                ['key' => 'icon_color', 'label' => 'Icon color class', 'type' => 'text'],
            ],
        ],

        'testimonials' => [
            'label' => 'Testimonials',
            'icon' => 'quote',
            'kind' => 'collection',
            'fields' => [
                ['key' => 'quote', 'label' => 'Quote', 'type' => 'textarea'],
                ['key' => 'author', 'label' => 'Author', 'type' => 'text'],
                ['key' => 'role', 'label' => 'Role', 'type' => 'text'],
            ],
        ],

        'pricing' => [
            'label' => 'Pricing plans',
            'icon' => 'tag',
            'kind' => 'collection',
            'fields' => [
                ['key' => 'name', 'label' => 'Plan name', 'type' => 'text'],
                ['key' => 'price', 'label' => 'Price', 'type' => 'text'],
                ['key' => 'period', 'label' => 'Period', 'type' => 'text'],
                ['key' => 'description', 'label' => 'Description', 'type' => 'text'],
                ['key' => 'features', 'label' => 'Features (one per line)', 'type' => 'list'],
                ['key' => 'cta', 'label' => 'CTA label', 'type' => 'text'],
                ['key' => 'popular', 'label' => 'Mark as most popular', 'type' => 'boolean'],
            ],
        ],

        'cta' => [
            'label' => 'Call to action band',
            'icon' => 'megaphone',
            'kind' => 'single',
            'fields' => [
                ['key' => 'headline', 'label' => 'Headline', 'type' => 'text'],
                ['key' => 'headline_accent', 'label' => 'Headline accent (gradient)', 'type' => 'text'],
                ['key' => 'subcopy', 'label' => 'Subcopy', 'type' => 'textarea'],
                ['key' => 'primary_cta_label', 'label' => 'Primary CTA label', 'type' => 'text'],
                ['key' => 'primary_cta_href', 'label' => 'Primary CTA link', 'type' => 'text'],
                ['key' => 'secondary_cta_label', 'label' => 'Secondary CTA label', 'type' => 'text'],
                ['key' => 'secondary_cta_href', 'label' => 'Secondary CTA link', 'type' => 'text'],
                ['key' => 'fine_print', 'label' => 'Fine print', 'type' => 'text'],
            ],
        ],

        'faqs' => [
            'label' => 'FAQs',
            'icon' => 'help',
            'kind' => 'collection',
            'fields' => [
                ['key' => 'question', 'label' => 'Question', 'type' => 'text'],
                ['key' => 'answer', 'label' => 'Answer', 'type' => 'textarea'],
            ],
        ],

        'blog' => [
            'label' => 'Blog',
            'icon' => 'file',
            'kind' => 'collection',
            'fields' => [],
        ],

        'navigation' => [
            'label' => 'Navigation',
            'icon' => 'menu',
            'kind' => 'collection',
            'fields' => [
                ['key' => 'label', 'label' => 'Label', 'type' => 'text'],
                ['key' => 'href', 'label' => 'Link', 'type' => 'text'],
            ],
        ],

        'footer' => [
            'label' => 'Footer',
            'icon' => 'layout',
            'kind' => 'collection',
            'fields' => [
                ['key' => 'label', 'label' => 'Label', 'type' => 'text'],
                ['key' => 'href', 'label' => 'Link', 'type' => 'text'],
            ],
        ],

        'seo' => [
            'label' => 'SEO defaults',
            'icon' => 'search',
            'kind' => 'single',
            'fields' => [
                ['key' => 'default_title', 'label' => 'Default page title', 'type' => 'text'],
                ['key' => 'default_description', 'label' => 'Default meta description', 'type' => 'textarea'],
                ['key' => 'og_image', 'label' => 'Default OG image URL', 'type' => 'text'],
            ],
        ],

        'legal' => [
            'label' => 'Legal pages',
            'icon' => 'scale',
            'kind' => 'collection',
            'fields' => [],
        ],

    ],

];
