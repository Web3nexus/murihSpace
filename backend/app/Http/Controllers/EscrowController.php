<?php

namespace App\Http\Controllers;

use App\Models\Dispute;
use App\Models\Escrow;
use App\Services\Escrow\EscrowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EscrowController extends Controller
{
    public function __construct(
        private EscrowService $escrowService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = Escrow::with([
            'buyer:id,name,username',
            'seller:id,name,username',
            'order:id,order_number',
            'disputes' => fn ($q) => $q->latest(),
        ])->latest();

        if ($request->user()->role !== 'admin') {
            $query->where(function ($q) use ($request) {
                $q->where('buyer_id', $request->user()->id)
                    ->orWhere('seller_id', $request->user()->id);
            });
        }

        if ($request->status && in_array($request->status, Escrow::STATUSES)) {
            $query->where('status', $request->status);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $escrow = Escrow::with([
            'buyer:id,name,username',
            'seller:id,name,username',
            'order:id,order_number,total,currency',
            'disputes' => fn ($q) => $q->with('raisedBy:id,name,username', 'admin:id,name,username')->latest(),
            'ledgerTransaction.entries',
        ])->findOrFail($id);

        if ($request->user()->role !== 'admin'
            && $escrow->buyer_id !== $request->user()->id
            && $escrow->seller_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json(['data' => $escrow]);
    }

    public function release(Request $request, int $id): JsonResponse
    {
        $escrow = Escrow::findOrFail($id);

        if ($escrow->seller_id !== $request->user()->id && $request->user()->role !== 'admin') {
            return response()->json(['message' => 'Only the seller or admin can release escrow.'], 403);
        }

        if ($request->user()->role !== 'admin') {
            $seller = $escrow->seller;
            if (! $seller || ! $seller->hasVerifiedKyc()) {
                return response()->json([
                    'message' => 'The seller must complete KYC identity verification before escrow funds can be released.',
                    'code' => 'KYC_REQUIRED',
                ], 403);
            }
        }

        if (! $escrow->isReleaseable()) {
            return response()->json(['message' => 'Escrow is not in a releasable state.'], 400);
        }

        // Single source of truth: EscrowService credits the seller's wallet.
        $this->escrowService->release($escrow);

        return response()->json(['message' => 'Escrow released to seller.', 'data' => $escrow->fresh()->load(['buyer:id,name', 'seller:id,name'])]);
    }

    public function refund(Request $request, int $id): JsonResponse
    {
        $escrow = Escrow::findOrFail($id);

        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Only admins can refund escrow.'], 403);
        }

        if (! $escrow->isReleaseable() && $escrow->status !== 'disputed') {
            return response()->json(['message' => 'Escrow cannot be refunded in its current state.'], 400);
        }

        // Single source of truth: EscrowService credits the buyer's wallet.
        $this->escrowService->refund($escrow);

        return response()->json(['message' => 'Escrow refunded to buyer.', 'data' => $escrow->fresh()]);
    }

    // ── Disputes ───────────────────────────────────────────────────

    public function openDispute(Request $request, int $escrowId): JsonResponse
    {
        $escrow = Escrow::findOrFail($escrowId);

        if ($escrow->buyer_id !== $request->user()->id && $escrow->seller_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if (! in_array($escrow->status, ['held', 'on_hold'], true)) {
            return response()->json(['message' => 'Only held or on-hold escrows can be disputed.'], 400);
        }

        $existing = Dispute::where('escrow_id', $escrow->id)
            ->whereIn('status', ['open', 'under_review'])
            ->exists();

        if ($existing) {
            return response()->json(['message' => 'An active dispute already exists for this escrow.'], 409);
        }

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:10', 'max:5000'],
        ]);

        $dispute = DB::transaction(function () use ($escrow, $request, $validated) {
            $escrow->update(['status' => 'disputed']);

            return Dispute::create([
                'escrow_id' => $escrow->id,
                'raised_by' => $request->user()->id,
                'reason' => $validated['reason'],
                'status' => 'open',
            ]);
        });

        return response()->json(['data' => $dispute], 201);
    }

    public function disputes(Request $request): JsonResponse
    {
        $query = Dispute::with([
            'escrow:id,amount,currency,status',
            'raisedBy:id,name,username',
            'admin:id,name,username',
        ])->latest();

        if ($request->user()->role === 'admin') {
            // Admins see all
        } else {
            $query->where('raised_by', $request->user()->id)
                ->orWhereHas('escrow', fn ($q) => $q->where('seller_id', $request->user()->id));
        }

        if ($request->status && in_array($request->status, Dispute::STATUSES)) {
            $query->where('status', $request->status);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function resolveDispute(Request $request, int $id): JsonResponse
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $dispute = Dispute::findOrFail($id);

        if (! in_array($dispute->status, ['open', 'under_review'])) {
            return response()->json(['message' => 'Dispute is already resolved.'], 400);
        }

        $validated = $request->validate([
            'resolution' => ['required', 'in:resolved_buyer,resolved_seller,cancelled'],
            'resolution_note' => ['nullable', 'string', 'max:5000'],
        ]);

        // Single source of truth: EscrowService records the resolution and
        // moves escrowed funds through the shared release/refund primitives.
        $this->escrowService->resolveDispute(
            $dispute,
            $validated['resolution'],
            $request->user()->id,
            $validated['resolution_note'] ?? null,
        );

        return response()->json(['message' => 'Dispute resolved.', 'data' => $dispute->fresh()]);
    }
}
