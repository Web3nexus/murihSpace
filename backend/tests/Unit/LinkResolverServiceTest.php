<?php

namespace Tests\Unit;

use App\Models\Community;
use App\Models\DigitalProduct;
use App\Models\Event;
use App\Models\PhysicalProduct;
use App\Models\Storefront;
use App\Models\User;
use App\Services\LinkResolverService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Covers the MurihSpace link contract in the link resolver.
 *
 * These assertions exist because the resolver is what produces link-preview
 * cards for the canonical share paths. Getting a shape wrong here does not
 * throw — it silently builds a preview card pointing at a URL that 404s when
 * tapped, which is exactly the kind of bug that survives review.
 */
class LinkResolverServiceTest extends TestCase
{
    use RefreshDatabase;

    private LinkResolverService $resolver;

    protected function setUp(): void
    {
        parent::setUp();
        $this->resolver = app(LinkResolverService::class);
    }

    public function test_it_ignores_input_that_is_not_a_murihspace_url(): void
    {
        // A foreign host that merely shares a path shape must never be rendered
        // as a MurihSpace preview card.
        $this->assertNull($this->resolver->resolve('https://example.com/live/abc'));
        $this->assertNull($this->resolver->resolve('https://evil.example/u/ada'));
        $this->assertNull($this->resolver->resolve('https://notmurihspace.com/p/1'));
        $this->assertNull($this->resolver->resolve('just some text'));
        $this->assertNull($this->resolver->resolve(''));
    }

    public function test_it_accepts_every_murihspace_host_including_subdomains(): void
    {
        foreach (['murihspace.com', 'web.murihspace.com', 'staging.murihspace.com',
            'live.murihspace.com'] as $host) {
            $result = $this->resolver->resolve("https://$host/live/abc");

            $this->assertNotNull($result, "expected $host to be recognised");
            $this->assertSame(LinkResolverService::TYPE_LIVE, $result['type']);
        }
    }

    public function test_it_returns_null_for_a_murihspace_url_that_is_not_content(): void
    {
        // Legal and marketing pages are not previewable content, and must not
        // be mistaken for a profile just because they have a single segment.
        $this->assertNull($this->resolver->resolve('https://web.murihspace.com/legal/privacy'));
        $this->assertNull($this->resolver->resolve('https://web.murihspace.com/help'));
    }

    public function test_it_builds_a_meeting_preview_from_the_canonical_short_path(): void
    {
        $result = $this->resolver->resolve('https://web.murihspace.com/m/murih-7f3a9c12');

        $this->assertNotNull($result);
        $this->assertSame(LinkResolverService::TYPE_MEETING, $result['type']);
        $this->assertSame('/m/murih-7f3a9c12', $result['url']);
        $this->assertSame('murih-7f3a9c12', $result['code'] ?? null);
    }

    public function test_it_accepts_legacy_meeting_aliases(): void
    {
        foreach (['/meeting/murih-7f3a9c12', '/meetings/murih-7f3a9c12'] as $path) {
            $result = $this->resolver->resolve('https://web.murihspace.com'.$path);

            $this->assertNotNull($result, "expected $path to resolve");
            $this->assertSame('/m/murih-7f3a9c12', $result['url'],
                "expected $path to normalise to the canonical path");
        }
    }

    public function test_it_builds_a_live_preview_and_keeps_the_token(): void
    {
        $result = $this->resolver->resolve('https://web.murihspace.com/live/abc123?ref=xyz');

        $this->assertNotNull($result);
        $this->assertSame(LinkResolverService::TYPE_LIVE, $result['type']);
        $this->assertSame('/live/abc123', $result['url']);
    }

    public function test_it_links_an_event_by_numeric_id_not_slug(): void
    {
        // The events API is typed show(int $id), so a slug URL would 404 in the
        // app. The canonical share path must therefore carry the id.
        $community = Community::factory()->create();

        Event::create([
            'creator_id' => User::factory()->create()->id,
            'community_id' => $community->id,
            'title' => 'Creator Meetup',
            'slug' => 'creator-meetup',
            'description' => 'Come say hello.',
            'status' => 'published',
            'event_type' => 'online',
            'start_date' => now()->addDay(),
            'end_date' => now()->addDays(2),
        ]);

        $result = $this->resolver->resolve('https://web.murihspace.com/e/creator-meetup');

        $this->assertNotNull($result);
        $this->assertSame(LinkResolverService::TYPE_EVENT, $result['type']);
        $this->assertSame('Creator Meetup', $result['title']);
        $this->assertSame('creator-meetup', $result['slug']);
        $this->assertStringStartsWith('/e/', $result['url']);
        $this->assertMatchesRegularExpression('#^/e/\d+$#', $result['url'],
            'the event URL must carry the numeric id so the app can resolve it');
    }

    public function test_it_reports_a_missing_event_as_inactive(): void
    {
        $result = $this->resolver->resolve('https://web.murihspace.com/e/999999');

        $this->assertNotNull($result);
        $this->assertFalse($result['is_active']);
        $this->assertSame('/app/events', $result['url']);
    }

    public function test_it_resolves_a_physical_product(): void
    {
        $product = PhysicalProduct::create([
            'creator_id' => User::factory()->create()->id,
            'sku' => 'VINYL-001',
            'title' => 'Signed Vinyl',
            'price' => 25,
            'is_active' => true,
        ]);

        // Built from the model rather than assumed: an identity sequence is a
        // shared resource, so `/p/1` only holds while nothing else has inserted.
        $result = $this->resolver->resolve('https://web.murihspace.com/p/'.$product->id);

        $this->assertNotNull($result);
        $this->assertSame(LinkResolverService::TYPE_PRODUCT, $result['type']);
        $this->assertSame('Signed Vinyl', $result['title']);
        $this->assertTrue($result['is_active']);
    }

    public function test_it_does_not_describe_a_delisted_product(): void
    {
        $product = PhysicalProduct::create([
            'creator_id' => User::factory()->create()->id,
            'sku' => 'RETIRED-001',
            'title' => 'Withdrawn Vinyl',
            'price' => 25,
            'is_active' => false,
        ]);

        $result = $this->resolver->resolve('https://web.murihspace.com/p/'.$product->id);

        $this->assertNotNull($result);
        $this->assertFalse($result['is_active']);
        $this->assertSame('This product is no longer available', $result['title']);
        $this->assertArrayNotHasKey('price', $result);
        $this->assertArrayNotHasKey('seller', $result);
    }

    public function test_it_resolves_a_product_from_a_storefront_sub_path(): void
    {
        $product = PhysicalProduct::create([
            'creator_id' => User::factory()->create()->id,
            'sku' => 'VINYL-001',
            'title' => 'Signed Vinyl',
            'price' => 25,
            'is_active' => true,
        ]);

        $result = $this->resolver->resolve(
            'https://web.murihspace.com/store/ada/p/'.$product->id,
        );

        $this->assertNotNull($result);
        $this->assertSame(LinkResolverService::TYPE_PRODUCT, $result['type']);
        $this->assertSame('Signed Vinyl', $result['title']);
    }

    public function test_it_keeps_the_catalogue_hint_in_the_product_url(): void
    {
        $product = DigitalProduct::create([
            'creator_id' => User::factory()->create()->id,
            'title' => 'Sample Course',
            'slug' => 'sample-course',
            'price' => 5000,
            'currency' => 'NGN',
            'is_public' => true,
        ]);

        $result = $this->resolver->resolve('https://web.murihspace.com/p/d_'.$product->id);

        $this->assertNotNull($result);
        $this->assertSame(LinkResolverService::TYPE_PRODUCT, $result['type']);
        $this->assertSame('/p/d_'.$product->id, $result['url'],
            'the emitted URL must keep the p_/d_ hint or it re-resolves to the other catalogue');
    }

    public function test_it_does_not_describe_a_private_community(): void
    {
        $community = Community::factory()->create([
            'slug' => 'secret-society',
            'name' => 'Secret Society',
            'visibility' => 'private',
        ]);

        $result = $this->resolver->resolve('https://web.murihspace.com/c/'.$community->slug);

        $this->assertNotNull($result);
        $this->assertFalse($result['is_active']);
        $this->assertSame('This community is no longer available', $result['title']);
        $this->assertArrayNotHasKey('description', $result);
        $this->assertArrayNotHasKey('members_count', $result);
    }

    public function test_it_does_not_describe_an_unpublished_storefront(): void
    {
        $user = User::factory()->create(['username' => 'ada']);
        Storefront::create([
            'user_id' => $user->id,
            'short_code' => 'ada',
            'display_name' => 'Ada Shop',
            'is_published' => false,
        ]);

        $result = $this->resolver->resolve('https://web.murihspace.com/store/ada');

        $this->assertNotNull($result);
        $this->assertFalse($result['is_active']);
        $this->assertSame('This storefront is no longer available', $result['title']);
        $this->assertArrayNotHasKey('owner', $result);
        $this->assertArrayNotHasKey('cover_url', $result);
    }

    public function test_it_reports_a_missing_product_as_inactive(): void
    {
        $result = $this->resolver->resolve('https://web.murihspace.com/p/4242');

        $this->assertNotNull($result);
        $this->assertFalse($result['is_active']);
        $this->assertSame('This product is no longer available', $result['title']);
    }

    public function test_it_builds_a_profile_preview_and_an_accepted_link_in_bio_url(): void
    {
        $user = User::factory()->create(['username' => 'ada']);

        $result = $this->resolver->resolve('https://web.murihspace.com/u/ada');

        $this->assertNotNull($result);
        $this->assertSame(LinkResolverService::TYPE_PROFILE, $result['type']);
        $this->assertSame('ada', $result['username'] ?? null);

        // A link-in-bio URL resolves to the owner's profile preview: the app
        // opens /l/{username} on the public profile, so previewing the profile
        // is what the recipient will actually see.
        $bio = $this->resolver->resolve('https://web.murihspace.com/l/ada');
        $this->assertNotNull($bio);
        $this->assertSame(LinkResolverService::TYPE_PROFILE, $bio['type']);
        $this->assertSame('/u/'.$user->username, $bio['url']);
    }

    public function test_it_builds_a_storefront_preview(): void
    {
        $user = User::factory()->create(['username' => 'ada']);
        Storefront::create([
            'user_id' => $user->id,
            'short_code' => 'ada',
            'display_name' => 'Ada Shop',
            'is_published' => true,
        ]);

        $result = $this->resolver->resolve('https://web.murihspace.com/store/ada');

        $this->assertNotNull($result);
        $this->assertSame(LinkResolverService::TYPE_STOREFRONT, $result['type']);
        $this->assertSame('/store/ada', $result['url']);
    }
}