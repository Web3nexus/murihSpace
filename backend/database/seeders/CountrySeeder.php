<?php

namespace Database\Seeders;

use App\Models\Country;
use App\Models\State;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class CountrySeeder extends Seeder
{
    public function run(): void
    {
        $countriesFile = database_path('data/countries.json');
        $statesFile = database_path('data/states.json');

        if (! File::exists($countriesFile) || ! File::exists($statesFile)) {
            return;
        }

        $countriesData = json_decode(File::get($countriesFile), true) ?? [];
        $statesData = json_decode(File::get($statesFile), true) ?? [];

        DB::transaction(function () use ($countriesData, $statesData) {
            $now = now();

            // Insert countries in chunks
            $countryRecords = [];
            $validIso2 = [];
            foreach ($countriesData as $c) {
                if (empty($c['iso2'])) continue;
                $iso2 = strtoupper($c['iso2']);
                $validIso2[$iso2] = true;
                $countryRecords[] = [
                    'iso2' => $iso2,
                    'iso3' => strtoupper($c['iso3'] ?? ''),
                    'name' => $c['name'] ?? '',
                    'calling_code' => $c['calling_code'] ?? '',
                    'flag' => $c['flag'] ?? '',
                    'currency' => $c['currency'] ?? '',
                    'state_required' => (bool) ($c['state_required'] ?? false),
                    'postal_code_required' => (bool) ($c['postal_code_required'] ?? false),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            foreach (array_chunk($countryRecords, 100) as $chunk) {
                Country::upsert($chunk, ['iso2'], ['iso3', 'name', 'calling_code', 'flag', 'currency', 'state_required', 'postal_code_required', 'updated_at']);
            }

            // Clear old states (DELETE keeps this transactional; TRUNCATE causes an implicit commit on MySQL/MariaDB)
            State::query()->delete();

            // Insert states in chunks (only for valid countries)
            $stateRecords = [];
            foreach ($statesData as $s) {
                if (empty($s['country_iso2']) || empty($s['name'])) continue;
                $iso2 = strtoupper($s['country_iso2']);
                if (! isset($validIso2[$iso2])) continue;

                $stateRecords[] = [
                    'country_iso2' => $iso2,
                    'code' => substr($s['code'] ?? $s['name'], 0, 50),
                    'name' => $s['name'],
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            foreach (array_chunk($stateRecords, 500) as $chunk) {
                State::insert($chunk);
            }
        });
    }
}
