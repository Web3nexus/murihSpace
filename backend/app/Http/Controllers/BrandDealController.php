<?php

namespace App\Http\Controllers;

use App\Models\BrandDeal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandDealController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $deals = BrandDeal::where('creator_id', $request->user()->id)
            ->with('brand:id,name,slug,logo_url,industry')
            ->latest()
            ->get()
            ->map(fn($d) => [
                'id' => $d->id,
                'title' => $d->title,
                'deal_type' => $d->deal_type,
                'status' => $d->status,
                'budget' => $d->budget,
                'currency' => $d->currency,
                'deliverables' => $d->deliverables,
                'starts_at' => $d->starts_at?->toIso8601String(),
                'ends_at' => $d->ends_at?->toIso8601String(),
                'created_at' => $d->created_at->toIso8601String(),
                'brand' => $d->brand ? [
                    'id' => $d->brand->id,
                    'name' => $d->brand->name,
                    'slug' => $d->brand->slug,
                    'logo_url' => $d->brand->logo_url,
                    'industry' => $d->brand->industry,
                ] : null,
            ]);

        return response()->json(['data' => $deals]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'brand_id' => ['required', 'exists:brands,id'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'deal_type' => ['required', 'in:' . implode(',', BrandDeal::DEAL_TYPES)],
            'status' => ['sometimes', 'in:' . implode(',', BrandDeal::STATUSES)],
            'budget' => ['required', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'max:3'],
            'deliverables' => ['nullable', 'string', 'max:5000'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ]);

        $validated['creator_id'] = $request->user()->id;

        $deal = BrandDeal::create($validated);

        return response()->json(['data' => $deal->load('brand:id,name,slug,logo_url,industry')], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $deal = BrandDeal::where('creator_id', $request->user()->id)->findOrFail($id);

        $validated = $request->validate([
            'title' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'deal_type' => ['sometimes', 'in:' . implode(',', BrandDeal::DEAL_TYPES)],
            'status' => ['sometimes', 'in:' . implode(',', BrandDeal::STATUSES)],
            'budget' => ['sometimes', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'max:3'],
            'deliverables' => ['nullable', 'string', 'max:5000'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
        ]);

        $deal->update($validated);

        return response()->json(['data' => $deal->fresh()->load('brand:id,name,slug,logo_url,industry')]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $deal = BrandDeal::where('creator_id', $request->user()->id)->findOrFail($id);
        $deal->delete();

        return response()->json(['message' => 'Deal deleted.']);
    }
}
