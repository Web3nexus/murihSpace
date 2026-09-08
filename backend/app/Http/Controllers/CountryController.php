<?php

namespace App\Http\Controllers;

use App\Models\Country;
use App\Models\State;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\File;

class CountryController extends Controller
{
    /**
     * List all supported countries with metadata.
     */
    public function index(): JsonResponse
    {
        $countries = Country::select([
            'iso2', 'iso3', 'name', 'calling_code', 'flag', 'currency', 'state_required', 'postal_code_required',
        ])
        ->orderBy('name')
        ->get();

        if ($countries->isEmpty()) {
            $countriesFile = database_path('data/countries.json');
            if (File::exists($countriesFile)) {
                $raw = json_decode(File::get($countriesFile), true) ?? [];
                usort($raw, fn ($a, $b) => strcmp($a['name'] ?? '', $b['name'] ?? ''));
                return response()->json([
                    'data' => $raw,
                ]);
            }
        }

        return response()->json([
            'data' => $countries,
        ]);
    }

    /**
     * List all states/provinces/regions for a specific country ISO2.
     */
    public function states(string $iso2): JsonResponse
    {
        $countryIso2 = strtoupper($iso2);

        $states = State::where('country_iso2', $countryIso2)
            ->select(['id', 'country_iso2', 'code', 'name'])
            ->orderBy('name')
            ->get();

        if ($states->isEmpty()) {
            $statesFile = database_path('data/states.json');
            if (File::exists($statesFile)) {
                $raw = json_decode(File::get($statesFile), true) ?? [];
                $filtered = array_values(array_filter($raw, fn ($s) => strtoupper($s['country_iso2'] ?? '') === $countryIso2));
                return response()->json([
                    'country_iso2' => $countryIso2,
                    'data' => $filtered,
                ]);
            }
        }

        return response()->json([
            'country_iso2' => $countryIso2,
            'data' => $states,
        ]);
    }
}
