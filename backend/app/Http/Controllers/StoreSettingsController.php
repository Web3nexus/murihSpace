<?php

namespace App\Http\Controllers;

use App\Models\Storefront;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreSettingsController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $settings = Storefront::where('user_id', $request->user()->id)->first();

        if (!$settings) {
            $settings = Storefront::create(['user_id' => $request->user()->id]);
        }

        return response()->json(['data' => $settings]);
    }

    public function update(Request $request): JsonResponse
    {
        $settings = Storefront::firstOrCreate(['user_id' => $request->user()->id]);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'tagline' => ['nullable', 'string', 'max:500'],
            'currency' => ['nullable', 'string', 'size:3'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'shipping_policy' => ['nullable', 'string', 'max:5000'],
            'return_policy' => ['nullable', 'string', 'max:5000'],
            'logo_url' => ['nullable', 'string', 'max:2000'],
            'banner_url' => ['nullable', 'string', 'max:2000'],
        ]);

        $settings->update($validated);

        return response()->json(['data' => $settings->fresh()]);
    }
}
