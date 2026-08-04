<?php

namespace App\Http\Controllers;

use App\Models\FeeRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminFeeController extends Controller
{
    /**
     * GET /api/v1/securegate/fees
     * List all platform fee rules for admins.
     */
    public function index(Request $request): JsonResponse
    {
        $query = FeeRule::query()->orderBy('priority', 'desc')->orderBy('name');

        if ($request->filled('category')) {
            $cat = $request->input('category');
            $query->where(function ($q) use ($cat) {
                $q->where('transaction_type', 'like', "%{$cat}%")
                  ->orWhere('code', 'like', "%{$cat}%");
            });
        }

        if ($request->filled('enabled')) {
            $query->where('enabled', filter_var($request->input('enabled'), FILTER_VALIDATE_BOOLEAN));
        }

        $rules = $query->get();

        return response()->json([
            'data' => $rules,
        ]);
    }

    /**
     * POST /api/v1/securegate/fees
     * Create a new fee rule.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name'                  => ['required', 'string', 'max:100'],
            'code'                  => ['required', 'string', 'max:50', 'unique:fee_rules,code'],
            'description'           => ['nullable', 'string', 'max:255'],
            'fee_type'              => ['required', 'string', 'in:fixed,percentage,fixed_plus_percentage,tiered'],
            'fixed_amount'          => ['nullable', 'integer', 'min:0'],
            'percentage'            => ['nullable', 'numeric', 'min:0', 'max:100', 'required_if:fee_type,percentage', 'required_if:fee_type,fixed_plus_percentage'],
            'minimum_fee'           => ['nullable', 'integer', 'min:0'],
            'maximum_fee'           => ['nullable', 'integer', 'min:0', 'gte:minimum_fee'],
            'currency'              => ['nullable', 'string', 'size:3', 'alpha'],
            'country'               => ['nullable', 'string', 'max:10'],
            'role'                  => ['nullable', 'string', 'max:30'],
            'wallet_type'           => ['nullable', 'string', 'max:20'],
            'transaction_type'      => ['nullable', 'string', 'max:50'],
            'payment_method'        => ['nullable', 'string', 'max:50'],
            'tiered_rates'          => ['required_if:fee_type,tiered', 'array', 'min:1'],
            'tiered_rates.*.up_to'  => ['nullable', 'integer', 'min:1'],
            'tiered_rates.*.percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'tiered_rates.*.fixed_amount' => ['nullable', 'integer', 'min:0'],
            'effective_from'        => ['nullable', 'date'],
            'effective_until'       => ['nullable', 'date', 'after_or_equal:effective_from'],
            'enabled'               => ['nullable', 'boolean'],
            'priority'              => ['nullable', 'integer'],
        ]);

        $rule = FeeRule::create(array_merge([
            'currency'     => 'NGN',
            'fixed_amount' => 0,
            'percentage'   => 0,
            'minimum_fee'  => 0,
            'enabled'      => true,
            'priority'     => 0,
        ], array_filter($validated, static fn ($value) => $value !== null)));

        return response()->json([
            'message' => 'Fee rule created successfully.',
            'data'    => $rule,
        ], 201);
    }

    /**
     * PUT /api/v1/securegate/fees/{id}
     * Update an existing fee rule.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $rule = FeeRule::findOrFail($id);

        $validated = $request->validate([
            'name'                  => ['sometimes', 'string', 'max:100'],
            'code'                  => ['sometimes', 'string', 'max:50', "unique:fee_rules,code,{$id}"],
            'description'           => ['nullable', 'string', 'max:255'],
            'fee_type'              => ['sometimes', 'string', 'in:fixed,percentage,fixed_plus_percentage,tiered'],
            'fixed_amount'          => ['nullable', 'integer', 'min:0'],
            'percentage'            => ['nullable', 'numeric', 'min:0', 'max:100', 'required_if:fee_type,percentage', 'required_if:fee_type,fixed_plus_percentage'],
            'minimum_fee'           => ['nullable', 'integer', 'min:0'],
            'maximum_fee'           => ['nullable', 'integer', 'min:0', 'gte:minimum_fee'],
            'currency'              => ['nullable', 'string', 'size:3', 'alpha'],
            'country'               => ['nullable', 'string', 'max:10'],
            'role'                  => ['nullable', 'string', 'max:30'],
            'wallet_type'           => ['nullable', 'string', 'max:20'],
            'transaction_type'      => ['nullable', 'string', 'max:50'],
            'payment_method'        => ['nullable', 'string', 'max:50'],
            'tiered_rates'          => ['required_if:fee_type,tiered', 'array', 'min:1'],
            'tiered_rates.*.up_to'  => ['nullable', 'integer', 'min:1'],
            'tiered_rates.*.percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'tiered_rates.*.fixed_amount' => ['nullable', 'integer', 'min:0'],
            'effective_from'        => ['nullable', 'date'],
            'effective_until'       => ['nullable', 'date', 'after_or_equal:effective_from'],
            'enabled'               => ['nullable', 'boolean'],
            'priority'              => ['nullable', 'integer'],
        ]);

        $rule->update($validated);

        return response()->json([
            'message' => 'Fee rule updated successfully.',
            'data'    => $rule->fresh(),
        ]);
    }

    /**
     * POST /api/v1/securegate/fees/{id}/toggle
     * Enable/disable a fee rule.
     */
    public function toggle(int $id): JsonResponse
    {
        $rule = FeeRule::findOrFail($id);
        $rule->update(['enabled' => ! $rule->enabled]);

        return response()->json([
            'message' => 'Fee rule status updated.',
            'data'    => $rule->fresh(),
        ]);
    }

    /**
     * DELETE /api/v1/securegate/fees/{id}
     * Delete a fee rule.
     */
    public function destroy(int $id): JsonResponse
    {
        $rule = FeeRule::findOrFail($id);
        $rule->delete();

        return response()->json([
            'message' => 'Fee rule deleted.',
        ]);
    }
}
