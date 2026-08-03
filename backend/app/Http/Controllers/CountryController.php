<?php

namespace App\Http\Controllers;

use App\Models\Country;
use App\Models\State;
use Illuminate\Http\JsonResponse;

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

        return response()->json([
            'country_iso2' => $countryIso2,
            'data' => $states,
        ]);
    }
}
