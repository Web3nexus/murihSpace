<?php

namespace App\Http\Controllers;

use App\Services\Accounting\AccountingStreamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminAccountingController extends Controller
{
    public function __construct(
        protected AccountingStreamService $accountingService
    ) {}

    /**
     * GET /api/v1/admin/accounting/overview
     * High level financial and revenue stream breakdown.
     */
    public function overview(Request $request): JsonResponse
    {
        $currency = $request->query('currency', 'USD');
        $startDate = $request->query('start_date');
        $endDate = $request->query('end_date');

        $metrics = $this->accountingService->getOverviewMetrics($currency);
        $summary = $this->accountingService->getStreamSummary($currency, $startDate, $endDate);

        return response()->json([
            'metrics' => $metrics,
            'summary' => $summary,
        ]);
    }

    /**
     * GET /api/v1/admin/accounting/streams
     * Paginated revenue stream entries with filtering.
     */
    public function streams(Request $request): JsonResponse
    {
        $filters = $request->only([
            'stream_type',
            'currency',
            'country_code',
            'source_system',
            'start_date',
            'end_date',
        ]);

        $perPage = min((int) $request->query('per_page', 25), 100);
        $entries = $this->accountingService->buildEntriesQuery($filters)->paginate($perPage);

        return response()->json($entries);
    }

    /**
     * GET /api/v1/admin/accounting/export
     * Export revenue entries as CSV for accounting audits.
     */
    public function export(Request $request): StreamedResponse
    {
        $filters = $request->only([
            'stream_type',
            'currency',
            'country_code',
            'source_system',
            'start_date',
            'end_date',
        ]);

        $entries = $this->accountingService->buildEntriesQuery($filters)->limit(5000)->get();

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="murihspace_revenue_journal_'.now()->format('Ymd_His').'.csv"',
        ];

        return response()->stream(function () use ($entries) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, [
                'Reference',
                'Date',
                'Stream Type',
                'Source System',
                'Source ID',
                'Currency',
                'Gross Amount',
                'Platform Fee',
                'Creator Share',
                'Gateway Fee',
                'Tax Amount',
                'Net Platform Revenue',
                'Country',
                'Tax Rate Applied %',
                'Tax Type',
            ]);

            foreach ($entries as $entry) {
                fputcsv($handle, [
                    $entry->reference,
                    $entry->created_at->toIso8601String(),
                    $entry->stream_type,
                    $entry->source_system,
                    $entry->source_id ?? 'N/A',
                    $entry->currency,
                    number_format($entry->gross_amount_cents / 100, 2, '.', ''),
                    number_format($entry->platform_fee_cents / 100, 2, '.', ''),
                    number_format($entry->creator_vendor_amount_cents / 100, 2, '.', ''),
                    number_format($entry->gateway_fee_cents / 100, 2, '.', ''),
                    number_format($entry->tax_amount_cents / 100, 2, '.', ''),
                    number_format($entry->net_platform_revenue_cents / 100, 2, '.', ''),
                    $entry->country_code ?? 'GLOBAL',
                    $entry->tax_rate_applied ?? '0.00',
                    $entry->tax_type ?? 'exempt',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }
}
