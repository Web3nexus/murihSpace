<?php

namespace App\Http\Controllers;

use App\Models\Address;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            'state' => ['required', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'country' => ['nullable', 'string', 'size:2'],
            'type' => ['nullable', 'in:shipping,billing,both'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $validated['user_id'] = $request->user()->id;
        $validated['label'] ??= 'Home';
        $validated['country'] ??= 'NG';
        $validated['type'] ??= 'both';

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
            'state' => ['sometimes', 'string', 'max:255'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'country' => ['nullable', 'string', 'size:2'],
            'type' => ['nullable', 'in:shipping,billing,both'],
            'is_default' => ['nullable', 'boolean'],
        ]);

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
}
