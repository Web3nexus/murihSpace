<?php

namespace App\Http\Controllers;

use App\Models\FeeConfiguration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminFeeController extends Controller
{
    public function index(): JsonResponse
    {
        $fees = FeeConfiguration::orderBy('fee_type')->get();

        return response()->json(['data' => $fees]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $fee = FeeConfiguration::findOrFail($id);

        $validated = $request->validate([
            'percentage' => 'numeric|min:0|max:100',
            'flat_fee' => 'integer|min:0',
            'is_active' => 'boolean',
            'name' => 'string|max:255',
            'description' => 'nullable|string|max:500',
        ]);

        $fee->update($validated);

        return response()->json(['data' => $fee]);
    }

    public function show(int $id): JsonResponse
    {
        $fee = FeeConfiguration::findOrFail($id);

        return response()->json(['data' => $fee]);
    }
}
