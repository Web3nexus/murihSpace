<?php

namespace App\Http\Controllers;

use App\Models\DigitalSaleSettlement;
use App\Models\Order;
use App\Services\Wallet\DigitalSaleService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class DigitalSaleController extends Controller
{
    public function __construct(private readonly DigitalSaleService $sales) {}

    /** Buyer opens a dispute on a digital purchase. Only within 48 hours of payment. */
    public function buyerDispute(Request $request, int $id): JsonResponse
    {
        $order = Order::findOrFail($id);
        if ((int) $order->buyer_id !== (int) $request->user()->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        try {
            $settlement = $this->sales->openDispute($order, 'buyer');
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        if (! $settlement) {
            return response()->json(['message' => 'This purchase has no seller settlement to dispute.'], 422);
        }

        return response()->json(['data' => $settlement]);
    }

    /** Staff decision on a disputed digital sale. */
    public function resolve(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate(['outcome' => ['required', 'string', 'in:seller_won,buyer_won']]);
        $settlement = DigitalSaleSettlement::findOrFail($id);

        try {
            $resolved = $this->sales->resolve($settlement, $validated['outcome']);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $resolved]);
    }
}
