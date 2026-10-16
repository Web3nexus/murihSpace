<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Resets OTP request and verification rate-limit counters from Cache.
 * Can reset for a specific phone number or purge all OTP rate limits.
 */
class OtpResetRateLimits extends Command
{
    protected $signature = 'otp:reset-limits {phone? : Optional E.164 phone number, e.g. +2348123456789}';

    protected $description = 'Reset OTP rate-limit counters from cache (per-number, daily, per-IP, or all)';

    public function handle(): int
    {
        $phone = $this->argument('phone');

        if ($phone) {
            $normalized = preg_replace('/[^\d+]/', '', (string) $phone);
            $this->info("Resetting OTP rate limits for: {$normalized}");

            $keys = [
                'otp:req:num:'.$normalized,
                'otp:req:daily:'.$normalized,
                'otp:req:daily:'.$normalized.':'.now()->format('Y-m-d'),
                'otp:req:daily:'.$normalized.':'.now()->subDay()->format('Y-m-d'),
                'otp:ver:num:'.$normalized,
            ];

            foreach ($keys as $key) {
                Cache::forget($key);
            }

            // Also check database cache table directly if database cache driver is active
            if (config('cache.default') === 'database') {
                $prefix = config('cache.prefix', '');
                DB::table('cache')
                    ->where('key', 'like', $prefix.'otp:%'.$normalized.'%')
                    ->delete();
            }

            $this->info('Rate limits cleared successfully for '.$normalized);

            return self::SUCCESS;
        }

        $this->warn('No phone number specified; resetting ALL OTP rate-limit counters...');

        if (config('cache.default') === 'database') {
            $prefix = config('cache.prefix', '');
            $count = DB::table('cache')
                ->where('key', 'like', $prefix.'otp:req:%')
                ->orWhere('key', 'like', $prefix.'otp:ver:%')
                ->delete();

            $this->info("Cleared {$count} OTP rate-limit cache entries from database cache.");
        } else {
            // For other drivers (Redis/file/array), flush or notify
            $this->info('Non-database cache in use. For full cache wipe use php artisan cache:clear.');
        }

        return self::SUCCESS;
    }
}
