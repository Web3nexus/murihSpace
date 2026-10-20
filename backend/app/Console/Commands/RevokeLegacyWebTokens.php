<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Revokes the bearer tokens that old browser sessions were issued as.
 *
 * Web and mobile logins both mint an 'auth-token' row, so the name alone cannot
 * separate them. The user agent can: every browser sends "Mozilla/...", and the
 * Flutter app sends Dart's own agent. Rows with no recorded user agent predate
 * that column and are left alone, so a mobile token is never removed by mistake.
 *
 * Without --force this only reports the counts. Nothing is deleted.
 */
class RevokeLegacyWebTokens extends Command
{
    protected $signature = 'tokens:revoke-legacy-web {--force : Delete the matching tokens. Without it, only the counts are shown}';

    protected $description = 'Revoke legacy web bearer tokens (auth-token issued to a browser). Mobile tokens are kept.';

    public const TOKEN_NAME = 'auth-token';

    public function handle(): int
    {
        $matching = self::legacyWebTokens();
        $count = (clone $matching)->count();

        $kept = PersonalAccessToken::query()
            ->where('name', self::TOKEN_NAME)
            ->whereNotIn('id', (clone $matching)->select('id'))
            ->count();

        $this->line("Legacy web tokens to revoke : {$count}");
        $this->line("auth-token rows kept        : {$kept} (mobile or unrecorded user agent)");

        if (! $this->option('force')) {
            $this->warn('Dry run. Nothing was deleted. Re-run with --force to revoke these tokens.');

            return self::SUCCESS;
        }

        $deleted = $matching->delete();

        $this->info("Revoked {$deleted} legacy web token(s).");

        return self::SUCCESS;
    }

    /**
     * @return Builder<PersonalAccessToken>
     */
    public static function legacyWebTokens(): Builder
    {
        return PersonalAccessToken::query()
            ->where('name', self::TOKEN_NAME)
            ->where('user_agent', 'like', 'Mozilla/%');
    }
}
