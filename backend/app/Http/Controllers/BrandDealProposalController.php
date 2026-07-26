<?php

namespace App\Http\Controllers;

use App\Models\BrandDealProposal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandDealProposalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $proposals = BrandDealProposal::where('creator_id', $request->user()->id)
            ->with('brand:id,name,slug,logo_url,industry')
            ->latest()
            ->get()
            ->map(fn($p) => [
                'id' => $p->id,
                'brand_name' => $p->brand_name,
                'brand_email' => $p->brand_email,
                'title' => $p->title,
                'pitch' => $p->pitch,
                'proposed_budget' => $p->proposed_budget,
                'currency' => $p->currency,
                'deliverables' => $p->deliverables,
                'status' => $p->status,
                'sent_at' => $p->sent_at?->toIso8601String(),
                'created_at' => $p->created_at->toIso8601String(),
                'brand' => $p->brand ? [
                    'id' => $p->brand->id,
                    'name' => $p->brand->name,
                    'slug' => $p->brand->slug,
                    'logo_url' => $p->brand->logo_url,
                ] : null,
            ]);

        return response()->json(['data' => $proposals]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'brand_id' => ['nullable', 'exists:brands,id'],
            'brand_name' => ['nullable', 'required_without:brand_id', 'string', 'max:255'],
            'brand_email' => ['nullable', 'email', 'max:255'],
            'title' => ['required', 'string', 'max:255'],
            'pitch' => ['required', 'string', 'max:10000'],
            'proposed_budget' => ['nullable', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'max:3'],
            'deliverables' => ['nullable', 'string', 'max:5000'],
        ]);

        $validated['creator_id'] = $request->user()->id;

        $proposal = BrandDealProposal::create($validated);

        return response()->json(['data' => $proposal->load('brand:id,name,slug,logo_url,industry')], 201);
    }

    public function send(Request $request, int $id): JsonResponse
    {
        $proposal = BrandDealProposal::where('creator_id', $request->user()->id)->findOrFail($id);

        $proposal->update([
            'status' => 'sent',
            'sent_at' => now(),
        ]);

        return response()->json(['data' => $proposal->fresh()->load('brand:id,name,slug,logo_url,industry')]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $proposal = BrandDealProposal::where('creator_id', $request->user()->id)->findOrFail($id);
        $proposal->delete();

        return response()->json(['message' => 'Proposal deleted.']);
    }
}
