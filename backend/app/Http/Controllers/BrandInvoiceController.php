<?php

namespace App\Http\Controllers;

use App\Models\BrandInvoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BrandInvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $invoices = BrandInvoice::where('creator_id', $request->user()->id)
            ->with('brandDeal:id,title')
            ->latest()
            ->get()
            ->map(fn($i) => [
                'id' => $i->id,
                'invoice_number' => $i->invoice_number,
                'brand_name' => $i->brand_name,
                'brand_email' => $i->brand_email,
                'amount' => $i->amount,
                'currency' => $i->currency,
                'description' => $i->description,
                'status' => $i->status,
                'due_date' => $i->due_date?->format('Y-m-d'),
                'paid_at' => $i->paid_at?->toIso8601String(),
                'notes' => $i->notes,
                'created_at' => $i->created_at->toIso8601String(),
                'deal' => $i->brandDeal ? ['id' => $i->brandDeal->id, 'title' => $i->brandDeal->title] : null,
            ]);

        return response()->json(['data' => $invoices]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'brand_deal_id' => ['nullable', 'exists:brand_deals,id'],
            'brand_name' => ['required', 'string', 'max:255'],
            'brand_email' => ['nullable', 'email', 'max:255'],
            'amount' => ['required', 'integer', 'min:1'],
            'currency' => ['sometimes', 'string', 'max:3'],
            'description' => ['nullable', 'string', 'max:2000'],
            'due_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $validated['creator_id'] = $request->user()->id;
        $validated['invoice_number'] = 'INV-' . strtoupper(Str::random(10));

        $invoice = BrandInvoice::create($validated);

        return response()->json(['data' => $invoice], 201);
    }

    public function markSent(Request $request, int $id): JsonResponse
    {
        $invoice = BrandInvoice::where('creator_id', $request->user()->id)->findOrFail($id);
        $invoice->update(['status' => 'sent']);

        return response()->json(['data' => $invoice->fresh()]);
    }

    public function markPaid(Request $request, int $id): JsonResponse
    {
        $invoice = BrandInvoice::where('creator_id', $request->user()->id)->findOrFail($id);
        $invoice->update(['status' => 'paid', 'paid_at' => now()]);

        return response()->json(['data' => $invoice->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $invoice = BrandInvoice::where('creator_id', $request->user()->id)->findOrFail($id);
        $invoice->delete();

        return response()->json(['message' => 'Invoice deleted.']);
    }
}
