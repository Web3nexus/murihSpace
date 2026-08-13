<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\CmsContentResource;
use App\Models\CmsContent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class PublicCmsController extends Controller
{
    /**
     * GET /api/public/cms/{section}
     *
     * Published content for one section, ordered by sort_order. Responses are
     * cached since marketing content changes rarely.
     */
    public function section(Request $request, string $section): JsonResponse
    {
        $sections = config('cms.sections');

        if (! isset($sections[$section])) {
            abort(404, "Unknown CMS section: {$section}");
        }

        $ttl = (int) config('cache.public_ttl', 300);

        $payload = Cache::remember("cms:{$section}:published", $ttl, function () use ($section) {
            return [
                'data' => CmsContentResource::collection(
                    CmsContent::query()
                        ->published()
                        ->where('section', $section)
                        ->orderBy('sort_order')
                        ->orderByDesc('published_at')
                        ->get()
                )->resolve(),
            ];
        });

        return response()->json($payload);
    }

    /**
     * GET /api/public/cms/{section}/{slug}
     */
    public function item(Request $request, string $section, string $slug): CmsContentResource
    {
        $sections = config('cms.sections');

        if (! isset($sections[$section])) {
            abort(404, "Unknown CMS section: {$section}");
        }

        $item = CmsContent::query()
            ->published()
            ->where('section', $section)
            ->where('slug', $slug)
            ->firstOrFail();

        return new CmsContentResource($item);
    }
}
