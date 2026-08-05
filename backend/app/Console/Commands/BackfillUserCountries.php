<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\Country;
use Illuminate\Console\Command;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;

#[Signature('users:detect-country')]
#[Description('Detects and backfills user country based on mobile number prefix')]
class BackfillUserCountries extends Command
{
    public function handle()
    {
        $this->info('Fetching countries...');
        // Order by longest calling code first to match most specific prefix (e.g. +1441 vs +1)
        $countries = Country::orderByRaw('LENGTH(calling_code) DESC')->get();
        
        $users = User::whereNull('country')->whereNotNull('mobile_number')->get();
        $this->info("Found {$users->count()} users missing country but having a mobile number.");

        $updatedCount = 0;

        foreach ($users as $user) {
            $mobile = $user->mobile_number;
            // Clean mobile number to just + and digits
            $mobile = '+' . preg_replace('/\D/', '', $mobile);

            foreach ($countries as $country) {
                $prefix = '+' . $country->calling_code;
                if (str_starts_with($mobile, $prefix)) {
                    $user->update(['country' => $country->iso2]);
                    $updatedCount++;
                    break;
                }
            }
        }

        $this->info("Successfully updated {$updatedCount} users with detected countries.");
        return 0;
    }
}
