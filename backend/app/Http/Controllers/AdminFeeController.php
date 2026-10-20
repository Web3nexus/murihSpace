<?php

namespace App\Http\Controllers;

use App\Models\FeeRule;
use App\Services\Commission\CommissionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            'data'             => $rules,
            'commission_rates' => app(\App\Services\Commission\CommissionService::class)->getAllRates(),
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

        $commissionType = CommissionService::commissionTypeForRuleCode($validated['code']);
        if ($commissionType !== null) {
            $this->assertCommissionRuleShape($validated, $validated['fee_type'], isset($validated['percentage']));
        }

        $rule = DB::transaction(function () use ($validated, $commissionType, $request) {
            $rule = FeeRule::create(array_merge([
                'currency'     => 'USD',
                'fixed_amount' => 0,
                'percentage'   => 0,
                'minimum_fee'  => 0,
                'enabled'      => true,
                'priority'     => 0,
            ], array_filter($validated, static fn ($value) => $value !== null)));

            if ($commissionType !== null) {
                $this->writeCommissionRate($rule, $request);
            }

            return $rule;
        });

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

        $previousCode = $rule->code;
        $wasCommissionRule = CommissionService::commissionTypeForRuleCode($previousCode) !== null;
        $newCode = $validated['code'] ?? $previousCode;
        $commissionType = CommissionService::commissionTypeForRuleCode($newCode);

        if ($wasCommissionRule && $newCode !== $previousCode) {
            return response()->json([
                'message' => 'The code of a commission fee rule cannot be changed. Edit its rate instead.',
            ], 422);
        }

        if ($commissionType !== null) {
            $this->assertCommissionRuleShape(
                $validated,
                $validated['fee_type'] ?? $rule->fee_type,
                (array_key_exists('percentage', $validated) ? $validated['percentage'] : $rule->percentage) !== null,
            );
        }

        DB::transaction(function () use ($rule, $validated, $commissionType, $request) {
            $rule->update($validated);

            if ($commissionType !== null) {
                $this->writeCommissionRate($rule, $request);
            }
        });

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
        if ($this->isCommissionRule($rule)) {
            return response()->json([
                'message' => 'A commission fee rule is always in force. Change its rate instead of disabling it.',
            ], 422);
        }

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
        if ($this->isCommissionRule($rule)) {
            return response()->json([
                'message' => 'A commission fee rule cannot be deleted. Change its rate instead.',
            ], 422);
        }

        $rule->delete();

        return response()->json(['message' => 'Fee rule deleted.']);
    }

    /**
     * GET /api/v1/securegate/fees/commission
     * Get platform commission percentage rates.
     */
    public function getCommissionRates(\App\Services\Commission\CommissionService $commissionService): JsonResponse
    {
        return response()->json([
            'data' => $commissionService->getAllRates(),
        ]);
    }

    /**
     * PUT /api/v1/securegate/fees/commission
     * Update platform commission percentage rates.
     */
    public function updateCommissionRates(Request $request, \App\Services\Commission\CommissionService $commissionService): JsonResponse
    {
        $validated = $request->validate([
            'rates'            => ['required', 'array'],
            'rates.general'    => ['nullable', 'numeric', 'min:0', 'max:100'],
            'rates.digital'    => ['nullable', 'numeric', 'min:0', 'max:100'],
            'rates.physical'   => ['nullable', 'numeric', 'min:0', 'max:100'],
            'rates.gifts'      => ['nullable', 'numeric', 'min:0', 'max:100'],
            'rates.escrow'     => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        $updated = $commissionService->updateRates($validated['rates'], $request->user(), $request->ip(), $request->userAgent());

        return response()->json([
            'message' => 'Platform commission percentage rates updated successfully.',
            'data'    => $updated,
        ]);
    }

    private function isCommissionRule(FeeRule $rule): bool
    {
        return CommissionService::commissionTypeForRuleCode($rule->code) !== null;
    }

    /**
     * A commission rule is a percentage that is always in force, so it must be one.
     */
    private function assertCommissionRuleShape(array $validated, string $feeType, bool $hasPercentage): void
    {
        if ($feeType !== 'percentage') {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'fee_type' => ['A commission fee rule must be a percentage.'],
            ]);
        }

        if (! $hasPercentage) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'percentage' => ['A commission fee rule needs a percentage.'],
            ]);
        }

        if (array_key_exists('enabled', $validated) && $validated['enabled'] === false) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'enabled' => ['A commission fee rule is always in force.'],
            ]);
        }
    }

    /**
     * Write the rule's rate into the commission setting CommissionService reads. The caller
     * is already inside a transaction. The cache is cleared now and again after commit.
     */
    private function writeCommissionRate(FeeRule $rule, Request $request): void
    {
        $service = app(CommissionService::class);
        $type = $service->setRateFromFeeRule($rule, $request->user(), $request->ip(), $request->userAgent());

        if ($type !== null) {
            $service->forgetCachedRate($type);
            // Clear again once committed, so a read between the two cannot cache the old rate.
            DB::afterCommit(fn () => $service->forgetCachedRate($type));
        }
    }
}
