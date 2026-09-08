<?php

namespace App\Http\Controllers;

use App\Models\Payout;
use App\Models\TaxLiability;
use App\Models\TaxRate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminTaxController extends Controller
{
    /**
     * GET /api/v1/admin/tax/summary
     * Overall tax liability breakdown by country and period.
     */
    public function summary(Request $request): JsonResponse
    {
        $country = $request->query('country_code');
        $status = $request->query('status');

        $query = TaxLiability::query()->latest('period_start');

        if ($country) {
            $query->where('country_code', strtoupper($country));
        }

        if ($status) {
            $query->where('status', $status);
        }

        $liabilities = $query->get();

        $totalCollected = $liabilities->sum('tax_collected_cents');
        $totalWhtWithheld = $liabilities->sum('wht_withheld_cents');
        $totalTaxableBase = $liabilities->sum('taxable_base_cents');

        return response()->json([
            'totals' => [
                'total_taxable_base_cents' => $totalTaxableBase,
                'total_tax_collected_cents' => $totalCollected,
                'total_wht_withheld_cents' => $totalWhtWithheld,
                'net_liability_cents' => $totalCollected + $totalWhtWithheld,
            ],
            'liabilities' => $liabilities,
        ]);
    }

    /**
     * GET /api/v1/admin/tax/rates
     * List all country tax rates.
     */
    public function rates(): JsonResponse
    {
        $rates = TaxRate::orderBy('country_code')->get();

        return response()->json([
            'rates' => $rates,
        ]);
    }

    /**
     * POST /api/v1/admin/tax/rates
     * Create or update a country tax rate.
     */
    public function storeRate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'country_code' => ['required', 'string', 'size:3'],
            'country_name' => ['required', 'string', 'max:100'],
            'tax_name' => ['required', 'string', 'max:100'],
            'standard_rate_percentage' => ['required', 'numeric', 'min:0', 'max:100'],
            'wht_rate_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'stream_rates' => ['nullable', 'array'],
            'is_active' => ['boolean'],
            'tax_number_format' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $validated['country_code'] = strtoupper($validated['country_code']);

        $rate = TaxRate::updateOrCreate(
            [
                'country_code' => $validated['country_code'],
                'tax_name' => $validated['tax_name'],
            ],
            $validated
        );

        return response()->json([
            'message' => 'Tax rate rule saved successfully.',
            'rate' => $rate,
        ]);
    }

    /**
     * GET /api/v1/admin/tax/wht-schedule
     * Creator & vendor Withholding Tax deduction schedule.
     */
    public function whtSchedule(Request $request): JsonResponse
    {
        // Query payouts with WHT metadata
        $payouts = Payout::with('user:id,name,email,username')
            ->whereNotNull('metadata->wht_amount_cents')
            ->latest()
            ->paginate(25);

        return response()->json($payouts);
    }

    /**
     * GET /api/v1/admin/tax/export
     * Statutory export schedule formatted for tax authorities.
     */
    public function export(Request $request): StreamedResponse
    {
        $liabilities = TaxLiability::latest('period_start')->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="murihspace_tax_liabilities_'.now()->format('Ymd').'.csv"',
        ];

        return response()->stream(function () use ($liabilities) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Period',
                'Start Date',
                'End Date',
                'Country',
                'Currency',
                'Tax Type',
                'Taxable Base',
                'VAT/Sales Tax Collected',
                'WHT Withheld',
                'Total Remittance Due',
                'Status',
                'Filing Reference',
            ]);

            foreach ($liabilities as $item) {
                fputcsv($handle, [
                    $item->period_identifier,
                    $item->period_start->toDateString(),
                    $item->period_end->toDateString(),
                    $item->country_code,
                    $item->currency,
                    $item->tax_type,
                    number_format($item->taxable_base_cents / 100, 2, '.', ''),
                    number_format($item->tax_collected_cents / 100, 2, '.', ''),
                    number_format($item->wht_withheld_cents / 100, 2, '.', ''),
                    number_format(($item->tax_collected_cents + $item->wht_withheld_cents) / 100, 2, '.', ''),
                    strtoupper($item->status),
                    $item->filing_reference ?? 'UNFILED',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}
