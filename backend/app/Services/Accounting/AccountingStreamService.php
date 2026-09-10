<?php

namespace App\Services\Accounting;

use App\Models\RevenueStreamEntry;
use App\Services\Tax\TaxCalculationService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AccountingStreamService
{
    public function __construct(
        protected TaxCalculationService $taxService
    ) {}

    /**
     * Record an immutable revenue journal entry into the accounting system.
     */
    public function recordRevenueEntry(array $data): RevenueStreamEntry
    {
        return DB::transaction(function () use ($data) {
            $streamType = $data['stream_type'] ?? 'other';
            $grossAmount = (int) ($data['gross_amount_cents'] ?? 0);
            $countryCode = isset($data['country_code']) ? strtoupper($data['country_code']) : null;
            $currency = strtoupper($data['currency'] ?? 'USD');

            // 1. Calculate or extract tax
            if (! isset($data['tax_amount_cents'])) {
                $taxResult = $this->taxService->calculateTax($grossAmount, $countryCode, $streamType);
                $taxAmount = $taxResult['tax_amount_cents'];
                $taxRateApplied = $taxResult['tax_rate_applied'];
                $taxType = $taxResult['tax_type'];
                $taxRateId = $taxResult['tax_rate_id'];
            } else {
                $taxAmount = (int) $data['tax_amount_cents'];
                $taxRateApplied = isset($data['tax_rate_applied']) ? (float) $data['tax_rate_applied'] : null;
                $taxType = $data['tax_type'] ?? 'vat';
                $taxRateId = $data['tax_rate_id'] ?? null;
            }

            $platformFee = (int) ($data['platform_fee_cents'] ?? 0);
            $creatorVendorAmount = (int) ($data['creator_vendor_amount_cents'] ?? 0);
            $gatewayFee = (int) ($data['gateway_fee_cents'] ?? 0);

            // If platform fee was not explicitly provided for direct streams (like ads, verification)
            if ($platformFee === 0 && $creatorVendorAmount === 0 && in_array($streamType, ['ads', 'verification'])) {
                // The entire gross minus tax is platform revenue
                $platformFee = max(0, $grossAmount - $taxAmount);
            }

            // Net recognized revenue for MurihSpace
            $netPlatformRevenue = (int) ($data['net_platform_revenue_cents'] ?? ($platformFee - $gatewayFee));

            $entry = RevenueStreamEntry::create([
                'reference' => $data['reference'] ?? ('REV_'.strtoupper(Str::random(18))),
                'stream_type' => $streamType,
                'source_system' => $data['source_system'] ?? 'backend',
                'source_id' => isset($data['source_id']) ? (string) $data['source_id'] : null,
                'currency' => $currency,
                'gross_amount_cents' => $grossAmount,
                'platform_fee_cents' => $platformFee,
                'creator_vendor_amount_cents' => $creatorVendorAmount,
                'gateway_fee_cents' => $gatewayFee,
                'tax_amount_cents' => $taxAmount,
                'net_platform_revenue_cents' => $netPlatformRevenue,
                'country_code' => $countryCode,
                'tax_rate_applied' => $taxRateApplied,
                'tax_type' => $taxType,
                'tax_rate_id' => $taxRateId,
                'metadata' => $data['metadata'] ?? null,
            ]);

            // 2. Accumulate tax liability if tax was collected
            if ($taxAmount > 0 && $countryCode) {
                $periodIdentifier = Carbon::now()->format('Y-m');
                $this->taxService->recordTaxLiability(
                    periodIdentifier: $periodIdentifier,
                    countryCode: $countryCode,
                    currency: $currency,
                    taxType: $taxType,
                    taxableBaseCents: $grossAmount,
                    taxCollectedCents: $taxAmount,
                    whtWithheldCents: 0
                );
            }

            return $entry;
        });
    }

    /**
     * Get aggregate breakdown by revenue stream.
     */
    public function getStreamSummary(?string $currency = 'USD', ?string $startDate = null, ?string $endDate = null): array
    {
        $query = RevenueStreamEntry::query();

        if ($currency) {
            $query->where('currency', strtoupper($currency));
        }

        if ($startDate) {
            $query->whereDate('created_at', '>=', $startDate);
        }

        if ($endDate) {
            $query->whereDate('created_at', '<=', $endDate);
        }

        $streams = [
            'ads' => 'Advertising',
            'commerce' => 'MurihStore Commerce',
            'subscriptions' => 'Creator Subscriptions',
            'tips_gifts' => 'Tips & Gifting',
            'verification' => 'Verification Badges',
            'other' => 'Other Operations',
        ];

        $results = $query->select('stream_type')
            ->selectRaw('COUNT(*) as transaction_count')
            ->selectRaw('SUM(gross_amount_cents) as total_gross_cents')
            ->selectRaw('SUM(platform_fee_cents) as total_platform_fee_cents')
            ->selectRaw('SUM(creator_vendor_amount_cents) as total_creator_cents')
            ->selectRaw('SUM(gateway_fee_cents) as total_gateway_cents')
            ->selectRaw('SUM(tax_amount_cents) as total_tax_cents')
            ->selectRaw('SUM(net_platform_revenue_cents) as total_net_cents')
            ->groupBy('stream_type')
            ->get()
            ->keyBy('stream_type');

        $breakdown = [];
        $totalGross = 0;
        $totalNet = 0;
        $totalTax = 0;
        $totalGatewayFees = 0;

        foreach ($streams as $key => $label) {
            $row = $results->get($key);
            $gross = $row ? (int) $row->total_gross_cents : 0;
            $net = $row ? (int) $row->total_net_cents : 0;
            $tax = $row ? (int) $row->total_tax_cents : 0;
            $gw = $row ? (int) $row->total_gateway_cents : 0;

            $totalGross += $gross;
            $totalNet += $net;
            $totalTax += $tax;
            $totalGatewayFees += $gw;

            $breakdown[] = [
                'stream_type' => $key,
                'label' => $label,
                'count' => $row ? (int) $row->transaction_count : 0,
                'gross_amount_cents' => $gross,
                'platform_fee_cents' => $row ? (int) $row->total_platform_fee_cents : 0,
                'creator_cents' => $row ? (int) $row->total_creator_cents : 0,
                'gateway_fee_cents' => $gw,
                'tax_amount_cents' => $tax,
                'net_revenue_cents' => $net,
            ];
        }

        return [
            'currency' => $currency,
            'summary' => [
                'total_gross_cents' => $totalGross,
                'total_net_cents' => $totalNet,
                'total_tax_cents' => $totalTax,
                'total_gateway_fee' => $totalGatewayFees,
            ],
            'streams' => $breakdown,
        ];
    }

    /**
     * Get high-level overview metrics for accounting dashboards.
     */
    public function getOverviewMetrics(?string $currency = 'USD'): array
    {
        $currency = strtoupper($currency ?? 'USD');
        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth();

        $monthQuery = RevenueStreamEntry::where('currency', $currency)
            ->where('created_at', '>=', $startOfMonth);

        $totalGrossMonth = (int) $monthQuery->sum('gross_amount_cents');
        $totalNetMonth = (int) $monthQuery->sum('net_platform_revenue_cents');
        $totalTaxMonth = (int) $monthQuery->sum('tax_amount_cents');
        $totalCountMonth = $monthQuery->count();

        return [
            'currency' => $currency,
            'period' => $now->format('F Y'),
            'month_gross_cents' => $totalGrossMonth,
            'month_net_cents' => $totalNetMonth,
            'month_tax_cents' => $totalTaxMonth,
            'month_tx_count' => $totalCountMonth,
        ];
    }

    /**
     * Build query for filterable entries.
     */
    public function buildEntriesQuery(array $filters = []): Builder
    {
        $query = RevenueStreamEntry::with('taxRate')->latest();

        if (! empty($filters['stream_type'])) {
            $query->where('stream_type', $filters['stream_type']);
        }

        if (! empty($filters['currency'])) {
            $query->where('currency', strtoupper($filters['currency']));
        }

        if (! empty($filters['country_code'])) {
            $query->where('country_code', strtoupper($filters['country_code']));
        }

        if (! empty($filters['source_system'])) {
            $query->where('source_system', $filters['source_system']);
        }

        if (! empty($filters['start_date'])) {
            $query->whereDate('created_at', '>=', $filters['start_date']);
        }

        if (! empty($filters['end_date'])) {
            $query->whereDate('created_at', '<=', $filters['end_date']);
        }

        return $query;
    }
}
