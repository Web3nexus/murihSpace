<?php

namespace App\Http\Controllers;

use App\Services\Accounting\AccountingStreamService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InternalAccountingSyncController extends Controller
{
    public function __construct(
        protected AccountingStreamService $accountingService
    ) {}

    /**
     * POST /api/v1/internal/accounting/sync-ad-revenue
     * Ingest advertising spend reported from web/ads-backend.
     */
    public function syncAdRevenue(Request $request): JsonResponse
    {
        // 1. Authenticate internal service key
        $providedKey = $request->header('X-Internal-Service-Key');
        $configuredKey = config('services.internal_service_key') ?? env('INTERNAL_SERVICE_KEY', 'murihspace_internal_ads_secret_key_default');

        if (empty($providedKey) || ! hash_equals($configuredKey, $providedKey)) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized internal service request.',
            ], 401);
        }

        // 2. Validate payload
        $validated = $request->validate([
            'amount_cents' => ['required', 'integer', 'min:1'],
            'currency' => ['required', 'string', 'size:3'],
            'advertiser_id' => ['required'],
            'campaign_id' => ['nullable'],
            'country_code' => ['nullable', 'string', 'size:3'],
            'tax_cents' => ['nullable', 'integer', 'min:0'],
            'description' => ['nullable', 'string', 'max:255'],
            'reference' => ['nullable', 'string', 'max:64'],
        ]);

        // 3. Ingest into Accounting Stream Journal
        $entry = $this->accountingService->recordRevenueEntry([
            'reference' => $validated['reference'] ?? null,
            'stream_type' => 'ads',
            'source_system' => 'ads-backend',
            'source_id' => $validated['campaign_id'] ?? $validated['advertiser_id'],
            'currency' => strtoupper($validated['currency']),
            'gross_amount_cents' => (int) $validated['amount_cents'],
            'tax_amount_cents' => $validated['tax_cents'] ?? null,
            'country_code' => ! empty($validated['country_code']) ? strtoupper($validated['country_code']) : null,
            'metadata' => [
                'advertiser_id' => $validated['advertiser_id'],
                'campaign_id' => $validated['campaign_id'] ?? null,
                'description' => $validated['description'] ?? 'Ad campaign budget consumption',
            ],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Ad revenue synchronized to central ledger.',
            'reference' => $entry->reference,
            'entry_id' => $entry->id,
        ], 201);
    }
}
