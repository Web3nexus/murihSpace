<?php

namespace App\Http\Controllers;

use App\Models\Address;
use App\Models\Country;
use App\Models\State;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AddressController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $addresses = Address::where('user_id', $request->user()->id)->latest()->get();

        return response()->json(['data' => $addresses]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:50'],
            'full_name' => ['required', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'street_line1' => ['required', 'string', 'max:500'],
            'street_line2' => ['nullable', 'string', 'max:500'],
            'city' => ['required', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'administrative_area_level_1' => ['nullable', 'string', 'max:255'],
            'administrative_area_level_2' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'country' => ['nullable', 'string', 'size:2', 'exists:countries,iso2'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'type' => ['nullable', 'in:shipping,billing,both'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $validated['user_id'] = $request->user()->id;
        $validated['label'] ??= 'Home';
        $validated['country'] = strtoupper($validated['country'] ?? 'NG');
        $validated['type'] ??= 'both';

        $this->validateStateForCountry($validated['country'], $validated['state'] ?? null);

        if ($validated['is_default'] ?? false) {
            Address::where('user_id', $request->user()->id)->update(['is_default' => false]);
        }

        $address = Address::create($validated);

        return response()->json(['data' => $address], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $address = Address::where('user_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'label' => ['nullable', 'string', 'max:50'],
            'full_name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'street_line1' => ['sometimes', 'string', 'max:500'],
            'street_line2' => ['nullable', 'string', 'max:500'],
            'city' => ['sometimes', 'string', 'max:255'],
            'state' => ['nullable', 'string', 'max:255'],
            'administrative_area_level_1' => ['nullable', 'string', 'max:255'],
            'administrative_area_level_2' => ['nullable', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'country' => ['nullable', 'string', 'size:2', 'exists:countries,iso2'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'type' => ['nullable', 'in:shipping,billing,both'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $country = strtoupper($validated['country'] ?? $address->country ?? 'NG');
        $state = array_key_exists('state', $validated) ? $validated['state'] : $address->state;

        $this->validateStateForCountry($country, $state);

        // Normalize the stored country to uppercase so it matches countries.iso2
        if (array_key_exists('country', $validated)) {
            $validated['country'] = $country;
        }

        if ($validated['is_default'] ?? false) {
            Address::where('user_id', $request->user()->id)->where('id', '!=', $id)->update(['is_default' => false]);
        }

        $address->update($validated);

        return response()->json(['data' => $address->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $address = Address::where('user_id', $request->user()->id)->findOrFail($id);
        $address->delete();

        return response()->json(['message' => 'Address deleted.']);
    }

    public function setDefault(Request $request, int $id): JsonResponse
    {
        $address = Address::where('user_id', $request->user()->id)->findOrFail($id);

        Address::where('user_id', $request->user()->id)->update(['is_default' => false]);
        $address->update(['is_default' => true]);

        return response()->json(['data' => $address->fresh()]);
    }

    private function validateStateForCountry(string $countryIso2, ?string $state): void
    {
        $country = Country::find($countryIso2);
        if (! $country) {
            return;
        }

        $hasStatesInDb = State::where('country_iso2', $countryIso2)->exists();

        if ($country->state_required && empty($state)) {
            throw ValidationException::withMessages([
                'state' => ["A state/province is required for country {$country->name}."],
            ]);
        }

        if ($hasStatesInDb && ! empty($state)) {
            $stateExists = State::where('country_iso2', $countryIso2)
                ->where(function ($q) use ($state) {
                    $q->where('code', $state)->orWhere('name', $state);
                })
                ->exists();

            if (! $stateExists) {
                throw ValidationException::withMessages([
                    'state' => ["The selected state/province '{$state}' is invalid for country {$country->name}."],
                ]);
            }
        }
    }
}
