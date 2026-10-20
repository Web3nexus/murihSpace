<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Escrow;
use App\Models\User;
use App\Services\Escrow\EscrowTimingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

class EscrowTimingController extends Controller
{
    /** Escrow states in which the transaction is paid and the parties may contact each other. */
    private const PAID_STATUSES = ['held', 'on_hold', 'released', 'disputed'];

    public function __construct(private readonly EscrowTimingService $timing) {}

    /** Buyer confirms a physical delivery. Starts the 7-day release clock. */
    public function confirmReceipt(Request $request, int $id): JsonResponse
    {
        $escrow = $this->participantEscrow($request, $id, buyerOnly: true);
        if ($escrow instanceof JsonResponse) return $escrow;

        return $this->attempt(fn () => $this->timing->recordBuyerReceipt($escrow, $request->user()), $escrow);
    }

    /** Buyer releases the funds now (CTA on a held or on-hold order). */
    public function releaseNow(Request $request, int $id): JsonResponse
    {
        $escrow = $this->participantEscrow($request, $id, buyerOnly: true);
        if ($escrow instanceof JsonResponse) return $escrow;

        return $this->attempt(fn () => $this->timing->releaseNow($escrow, $request->user()), $escrow);
    }

    /** Either party continues an automatic no-delivery hold, which makes the escrow active again. */
    public function resume(Request $request, int $id): JsonResponse
    {
        $escrow = $this->participantEscrow($request, $id, buyerOnly: false);
        if ($escrow instanceof JsonResponse) return $escrow;

        return $this->attempt(fn () => $this->timing->resume($escrow, $request->user()), $escrow);
    }

    /** Staff hold on one transaction. Requires the wallets (funds) permission or super admin. */
    public function hold(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);
        $escrow = Escrow::findOrFail($id);

        return $this->attempt(
            fn () => $this->timing->holdManually($escrow, $request->user(), $validated['reason']),
            $escrow->fresh(),
        );
    }

    /** Staff lifts a hold. Recorded in the audit log. */
    public function unhold(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']]);
        $escrow = Escrow::findOrFail($id);

        return $this->attempt(
            fn () => $this->timing->releaseHold($escrow, $request->user(), $validated['reason']),
            $escrow->fresh(),
        );
    }

    /**
     * The other party's mobile number, for a paid order only. Each party can see the
     * other's number and nothing else. Responses are never cached.
     */
    public function counterpartyContact(Request $request, int $id): JsonResponse
    {
        $escrow = Escrow::findOrFail($id);
        $me = $request->user();

        $isBuyer = (int) $escrow->buyer_id === (int) $me->id;
        $isSeller = (int) $escrow->seller_id === (int) $me->id;
        if (! $isBuyer && ! $isSeller) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        if (! in_array($escrow->status, self::PAID_STATUSES, true)) {
            return response()->json(['message' => 'Contact details are shared once the order is paid.'], 403);
        }

        $other = User::withTrashed()->find($isBuyer ? $escrow->seller_id : $escrow->buyer_id);

        return response()->json([
            'data' => [
                'name' => $other?->name,
                'username' => $other?->username,
                'mobile_number' => $other?->mobile_number,
            ],
        ])->header('Cache-Control', 'no-store, private');
    }

    private function participantEscrow(Request $request, int $id, bool $buyerOnly): Escrow|JsonResponse
    {
        $escrow = Escrow::findOrFail($id);
        $me = $request->user();

        $allowed = $buyerOnly
            ? (int) $escrow->buyer_id === (int) $me->id
            : in_array((int) $me->id, [(int) $escrow->buyer_id, (int) $escrow->seller_id], true);

        if (! $allowed) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return $escrow;
    }

    private function attempt(callable $action, Escrow $escrow): JsonResponse
    {
        try {
            $action();
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        return response()->json(['data' => $escrow->fresh()]);
    }
}
