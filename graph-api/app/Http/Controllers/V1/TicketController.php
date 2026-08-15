<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Services\MarketingApiClient;
use App\Support\ResponseNormaliser;

/**
 * Phase 4: Customer Support Tickets.
 *
 * GET /v1/tickets/categories           — categories available for ticket creation
 * GET /v1/tickets                      — authenticated user's support tickets
 * POST /v1/tickets                     — create a new support ticket
 * GET /v1/tickets/{id}                 — show a specific ticket with message thread
 * POST /v1/tickets/{id}/reply          — reply to a ticket
 * POST /v1/tickets/{id}/status         — update ticket status (close/reopen)
 * POST /v1/tickets/{id}/rate           — rate a resolved/closed ticket
 */
class TicketController extends Controller
{
    public function __construct(private readonly MarketingApiClient $marketingApi) {}

    /** GET /v1/tickets/categories */
    public function categories(Request $request): JsonResponse
    {
        $email = $this->userEmail($request);
        $data  = $this->marketingApi->getTicketCategories($email);

        return response()->json([
            'data' => $data['data'] ?? $data,
            'meta' => [],
        ]);
    }

    /** GET /v1/tickets */
    public function index(Request $request): JsonResponse
    {
        $email = $this->userEmail($request);
        $data  = $this->marketingApi->getTickets($email, $request->only(['status']));

        return response()->json(ResponseNormaliser::collection($data));
    }

    /** POST /v1/tickets */
    public function store(Request $request): JsonResponse
    {
        $email = $this->userEmail($request);
        $data  = $this->marketingApi->createTicket($email, $request->all());

        return response()->json([
            'data'    => ResponseNormaliser::ticket($data['data'] ?? $data),
            'message' => $data['message'] ?? 'Ticket created.',
        ], 201);
    }

    /** GET /v1/tickets/{id} */
    public function show(Request $request, string $id): JsonResponse
    {
        $email = $this->userEmail($request);
        $data  = $this->marketingApi->getTicket($email, $id);

        return response()->json([
            'data' => ResponseNormaliser::ticket($data['data'] ?? $data),
            'meta' => [],
        ]);
    }

    /** POST /v1/tickets/{id}/reply */
    public function reply(Request $request, string $id): JsonResponse
    {
        $email = $this->userEmail($request);
        $data  = $this->marketingApi->replyTicket($email, $id, $request->all());

        return response()->json([
            'data'    => $data['data'] ?? $data,
            'message' => $data['message'] ?? 'Reply sent.',
        ]);
    }

    /** POST /v1/tickets/{id}/status */
    public function status(Request $request, string $id): JsonResponse
    {
        $email = $this->userEmail($request);
        $data  = $this->marketingApi->updateTicketStatus($email, $id, $request->all());

        return response()->json([
            'data'    => $data['data'] ?? $data,
            'message' => $data['message'] ?? 'Status updated.',
        ]);
    }

    /** POST /v1/tickets/{id}/rate */
    public function rate(Request $request, string $id): JsonResponse
    {
        $email = $this->userEmail($request);
        $data  = $this->marketingApi->rateTicket($email, $id, $request->all());

        return response()->json([
            'data'    => $data['data'] ?? $data,
            'message' => $data['message'] ?? 'Rating saved.',
        ]);
    }

    private function userEmail(Request $request): string
    {
        $user = $request->attributes->get('graph_user');
        return $user['email'] ?? $request->header('X-Customer-Email', 'user@murihspace.com');
    }
}
