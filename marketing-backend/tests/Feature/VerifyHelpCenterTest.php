<?php

namespace Tests\Feature;

use App\Models\HelpArticle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class VerifyHelpCenterTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_passes_when_seed_matches_the_database(): void
    {
        $this->artisan('support:migrate-help-center')->assertSuccessful();
        $this->artisan('support:migrate-help-center')->assertSuccessful();

        $this->artisan('support:help-verify')
            ->expectsOutputToContain('Verification passed')
            ->assertSuccessful();
    }

    public function test_it_fails_when_an_article_is_missing(): void
    {
        $this->artisan('support:migrate-help-center')->assertSuccessful();
        $this->artisan('support:migrate-help-center')->assertSuccessful();

        HelpArticle::where('slug', 'send-gift')->forceDelete();

        $this->artisan('support:help-verify')
            ->expectsOutputToContain('Missing Article in actual: send-gift')
            ->assertFailed();
    }

    public function test_it_fails_when_article_content_has_drifted(): void
    {
        $this->artisan('support:migrate-help-center')->assertSuccessful();
        $this->artisan('support:migrate-help-center')->assertSuccessful();

        HelpArticle::where('slug', 'wallet-types')->update(['title' => 'Wallets explained']);

        $this->artisan('support:help-verify')
            ->expectsOutputToContain("Article 'wallet-types' title mismatch")
            ->assertFailed();
    }

    public function test_no_exit_flag_returns_success_despite_drift(): void
    {
        $this->artisan('support:migrate-help-center')->assertSuccessful();

        HelpArticle::where('slug', 'privacy')->update(['state' => 'draft']);

        $this->artisan('support:help-verify --no-exit')
            ->expectsOutputToContain("Article 'privacy' is 'draft' in the DB")
            ->assertSuccessful();
    }

    public function test_it_warns_about_cms_managed_extras_without_failing(): void
    {
        $this->artisan('support:migrate-help-center')->assertSuccessful();

        HelpArticle::create([
            'category_id' => 1,
            'slug' => 'cms-only-article',
            'title' => 'CMS managed',
            'excerpt' => 'Added via the CMS, not the seed.',
            'body' => '## CMS\n\nManaged content.',
            'state' => 'published',
            'sections' => [['heading' => 'CMS', 'body' => 'Managed content.']],
            'keywords' => ['cms'],
        ]);

        $this->artisan('support:help-verify --no-exit')
            ->expectsOutputToContain('Extra Article in actual (not in seed, likely CMS-managed): cms-only-article')
            ->assertSuccessful();
    }

    public function test_it_compares_against_a_live_api(): void
    {
        $fixture = base_path('tests/fixtures/help-center-minimal.json');

        Http::fake([
            '*/categories' => Http::response([
                ['id' => 'getting-started', 'name' => 'Getting Started', 'blurb' => 'Create an account, verify your email and get around MurihSpace.', 'icon' => null],
            ]),
            '*/articles' => Http::response([
                ['id' => 'create-account', 'title' => 'How to create a MurihSpace account', 'excerpt' => 'Sign up as a member, creator or vendor in a few simple steps.', 'category' => 'getting-started', 'keywords' => ['sign up', 'register', 'account', 'create', 'join', 'onboarding', 'username']],
            ]),
            '*/articles/*' => Http::response([
                'id' => 'create-account',
                'category' => 'getting-started',
                'title' => 'How to create a MurihSpace account',
                'excerpt' => 'Sign up as a member, creator or vendor in a few simple steps.',
                'sections' => [
                    ['heading' => 'Choose your account type', 'body' => 'During sign-up you can register as a Member, Creator or Vendor. Creators get storefronts and subscription tools, Vendors can sell products, and Members can join communities and buy. You can upgrade your role later from Settings.'],
                    ['heading' => 'Pick a unique username', 'body' => 'Your username is your public handle (@you). We check availability instantly while you type, so pick something short and memorable.'],
                    ['heading' => 'Verify your email', 'body' => 'After registering we send a 6-digit code to your inbox. Enter it on the verification screen to unlock the full app — including the AI assistant. Didn\'t receive it? Tap "Send code" to resend.'],
                ],
                'keywords' => ['sign up', 'register', 'account', 'create', 'join', 'onboarding', 'username'],
                'related' => [['id' => 'verify-email', 'title' => 'Verifying your email address']],
            ]),
        ]);

        $this->artisan("support:help-verify --file={$fixture} --api=https://help.example.com/api/public/help")
            ->expectsOutputToContain('Verification passed')
            ->assertSuccessful();
    }

    public function test_it_fails_when_the_api_is_unreachable(): void
    {
        Http::fake(fn () => Http::response('', 500));

        $this->artisan('support:help-verify --api=https://help.example.com/api/public/help')
            ->expectsOutputToContain('Help API returned an error')
            ->assertFailed();
    }
}
