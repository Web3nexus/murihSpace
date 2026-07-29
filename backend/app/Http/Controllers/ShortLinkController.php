<?php

namespace App\Http\Controllers;

use App\Models\ShortLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShortLinkController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $links = ShortLink::where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return response()->json(['data' => $links]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'target_url' => ['required', 'string', 'url', 'max:500'],
            'title' => ['nullable', 'string', 'max:100'],
            'resource_type' => ['nullable', 'string', 'max:50'],
            'resource_id' => ['nullable', 'integer'],
        ]);

        $data['user_id'] = $request->user()->id;
        $data['code'] = ShortLink::generateCode();

        $link = ShortLink::create($data);

        return response()->json(['data' => $link], 201);
    }

    public function destroy(Request $request, ShortLink $shortLink): JsonResponse
    {
        if ($shortLink->user_id !== $request->user()->id) abort(403);
        $shortLink->delete();
        return response()->json(['message' => 'Short link deleted.']);
    }

    public function redirect(string $code): \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
    {
        $link = ShortLink::where('code', $code)->where('is_active', true)->first();

        if (! $link) {
            abort(404, 'Short link not found.');
        }

        $link->recordClick();

        return redirect($link->target_url, 302);
    }
}
