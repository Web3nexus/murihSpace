<?php

namespace App\Http\Controllers;

use App\Services\LinkResolverService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public endpoint used by chat, posts and share sheets to turn a pasted
 * MurihSpace link into an actionable preview ("Join Meeting" / "Join Live" /
 * "View Event").
 *
 * It is deliberately unauthenticated so previews render for guests too, and it
 * never exposes private data — only the same metadata the public pages show.
 */
class LinkPreviewController extends Controller
{
    public function __construct(private readonly LinkResolverService $links) {}

    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'max:2048'],
        ]);

        $resolved = $this->links->resolve($validated['url']);

        if ($resolved === null) {
            return response()->json([
                'success' => false,
                'data' => null,
                'message' => 'This link is not a recognised MurihSpace meeting, live or event link.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $resolved,
        ]);
    }

    /**
     * Batch variant so a long chat transcript costs a single request.
     */
    public function batch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'urls' => ['required', 'array', 'max:20'],
            'urls.*' => ['string', 'max:2048'],
        ]);

        $previews = [];
        foreach (array_slice(array_unique($validated['urls']), 0, 20) as $url) {
            $resolved = $this->links->resolve($url);
            if ($resolved !== null) {
                $previews[$url] = $resolved;
            }
        }

        return response()->json([
            'success' => true,
            'data' => $previews,
        ]);
    }
}
