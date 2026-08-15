<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\MarketingApiClient;
use App\Support\ResponseNormaliser;

/**
 * Phase 4: Announcements & Marketing CMS Content.
 *
 * GET /v1/announcements            — list platform announcements
 * GET /v1/cms/{section}            — list items in a CMS section (e.g. landing, terms, privacy)
 * GET /v1/cms/{section}/{slug}     — show a single CMS item
 */
class MarketingContentController extends Controller
{
    public function __construct(private readonly MarketingApiClient $marketingApi) {}

    /** GET /v1/announcements */
    public function announcements(Request $request): JsonResponse
    {
        $data = $this->marketingApi->getAnnouncements();

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** GET /v1/cms/{section} */
    public function cmsSection(Request $request, string $section): JsonResponse
    {
        $data = $this->marketingApi->getCmsSection($section);

        return response()->json([
            'data' => $data['data'] ?? $data,
            'meta' => [],
        ]);
    }

    /** GET /v1/cms/{section}/{slug} */
    public function cmsItem(Request $request, string $section, string $slug): JsonResponse
    {
        $data = $this->marketingApi->getCmsItem($section, $slug);

        return response()->json([
            'data' => $data['data'] ?? $data,
            'meta' => [],
        ]);
    }
}
