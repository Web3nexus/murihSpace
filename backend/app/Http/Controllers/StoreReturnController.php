<?php

namespace App\Http\Controllers;

use App\Models\StoreReturn;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StoreReturnController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $returns = StoreReturn::where('user_id', $request->user()->id)
            ->with('fulfilmentOrder')
            ->latest()->get();

        return response()->json(['data' => $returns]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fulfilment_order_id' => ['required', 'exists:fulfilment_orders,id'],
            'product_name' => ['required', 'string', 'max:255'],
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $return = StoreReturn::create([
            'user_id' => $request->user()->id,
            'fulfilment_order_id' => $validated['fulfilment_order_id'],
            'product_name' => $validated['product_name'],
            'reason' => $validated['reason'],
            'status' => 'pending',
        ]);

        return response()->json(['data' => $return], 201);
    }

    public function update(Request $request, StoreReturn $return): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'string', 'in:pending,approved,rejected,completed'],
            'admin_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $return->update($validated);

        return response()->json(['data' => $return->fresh()]);
    }
}
