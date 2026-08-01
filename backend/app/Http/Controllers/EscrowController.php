<?php

namespace App\Http\Controllers;

use App\Models\Dispute;
use App\Models\Escrow;
use App\Models\LedgerEntry;
use App\Models\LedgerTransaction;
use App\Models\Wallet;
use App\Services\Wallet\LedgerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EscrowController extends Controller
{
    public function __construct(
        private LedgerService $ledgerService,
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

        DB::transaction(function () use ($escrow) {
            $txn = $this->ledgerService->credit(
                $escrow->seller_id,
                $escrow->amount,
                $escrow->currency,
                'escrow_release',
                "Escrow release for order #{$escrow->order_id}",
                ['escrow_id' => $escrow->id],
            );

            // Debit from escrow account
            $this->ledgerService->debit(
                $escrow->buyer_id,
                $escrow->amount,
                $escrow->currency,
                'escrow_release',
                "Escrow release for order #{$escrow->order_id}",
                ['escrow_id' => $escrow->id],
            );

            $escrow->update([
                'status' => 'released',
                'released_at' => now(),
                'ledger_transaction_id' => $txn->id,
            ]);
        });

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

        DB::transaction(function () use ($escrow) {
            $txn = $this->ledgerService->credit(
                $escrow->buyer_id,
                $escrow->amount,
                $escrow->currency,
                'escrow_refund',
                "Escrow refund for order #{$escrow->order_id}",
                ['escrow_id' => $escrow->id],
            );

            $this->ledgerService->debit(
                $escrow->seller_id,
                $escrow->amount,
                $escrow->currency,
                'escrow_refund',
                "Escrow refund for order #{$escrow->order_id}",
                ['escrow_id' => $escrow->id],
            );

            $escrow->update([
                'status' => 'refunded',
                'ledger_transaction_id' => $txn->id,
            ]);
        });

        return response()->json(['message' => 'Escrow refunded to buyer.', 'data' => $escrow->fresh()]);
    }

    // ── Disputes ───────────────────────────────────────────────────

    public function openDispute(Request $request, int $escrowId): JsonResponse
    {
        $escrow = Escrow::findOrFail($escrowId);

        if ($escrow->buyer_id !== $request->user()->id && $escrow->seller_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($escrow->status !== 'held') {
            return response()->json(['message' => 'Only held escrows can be disputed.'], 400);
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

        DB::transaction(function () use ($dispute, $request, $validated) {
            $dispute->resolve(
                $validated['resolution'],
                $request->user()->id,
                $validated['resolution_note'] ?? null,
            );

            if ($validated['resolution'] === 'resolved_buyer') {
                // Refund to buyer
                $this->ledgerService->credit(
                    $dispute->escrow->buyer_id,
                    $dispute->escrow->amount,
                    $dispute->escrow->currency,
                    'escrow_refund',
                    "Dispute resolved in favor of buyer for escrow #{$dispute->escrow_id}",
                    ['dispute_id' => $dispute->id],
                );
                $dispute->escrow->update(['status' => 'refunded']);
            } elseif ($validated['resolution'] === 'resolved_seller') {
                // Release to seller
                $this->ledgerService->credit(
                    $dispute->escrow->seller_id,
                    $dispute->escrow->amount,
                    $dispute->escrow->currency,
                    'escrow_release',
                    "Dispute resolved in favor of seller for escrow #{$dispute->escrow_id}",
                    ['dispute_id' => $dispute->id],
                );
                $dispute->escrow->update(['status' => 'released', 'released_at' => now()]);
            } else {
                $dispute->escrow->update(['status' => 'held']);
            }
        });

        return response()->json(['message' => 'Dispute resolved.', 'data' => $dispute->fresh()]);
    }
}
