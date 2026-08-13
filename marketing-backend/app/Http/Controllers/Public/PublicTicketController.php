<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Services\SlaService;
use App\Services\TicketAutomationEngine;
use App\Services\TicketNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class PublicTicketController extends Controller
{
    /**
     * POST /api/public/help/tickets
     * Body: { "subject", "description", "email", "category_slug"?, "priority"?,
     *        "context": { "search_query"?, "attempted_article"?, "current_page"?,
     *                     "user_id"?, "device"? } }
     *
     * Public entry point for the help center "contact support" channel. The
     * optional context object captures what the visitor was doing (their search,
     * an article that did not help, the page they were on and their device) so
     * support agents can pick up where the self-service flow failed.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = Validator::make($request->all(), [
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:10000'],
            'email' => ['required', 'email', 'max:255'],
            'category_slug' => ['nullable', 'string', 'max:120', 'exists:ticket_categories,slug'],
            'priority' => ['nullable', 'in:'.implode(',', Ticket::PRIORITIES)],
            'context.search_query' => ['nullable', 'string', 'max:500'],
            'context.attempted_article' => ['nullable', 'string', 'max:500'],
            'context.current_page' => ['nullable', 'string', 'max:500'],
            'context.user_id' => ['nullable', 'integer'],
            'context.device' => ['nullable', 'string', 'max:1000'],
        ])->validate();

        $ticket = DB::transaction(function () use ($validated, $request) {
            $category = isset($validated['category_slug'])
                ? TicketCategory::query()->where('slug', $validated['category_slug'])->first()
                : null;

            $context = $this->normalizeContext($validated['context'] ?? [], $request);

            $ticket = Ticket::create([
                'ticket_number' => Ticket::generateTicketNumber(),
                'subject' => $validated['subject'],
                'description' => $validated['description'],
                'customer_email' => $validated['email'],
                'context' => $context,
                'category_id' => $category?->id,
                'priority' => $validated['priority'] ?? 'normal',
                'status' => 'new',
                'channel' => 'help_center_form',
                'created_by' => null,
            ]);

            (new TicketAutomationEngine)->apply($ticket, 'created');
            (new SlaService)->assignPolicy($ticket);

            return $ticket;
        });

        app(TicketNotifier::class)->ticketCreated($ticket);

        return response()->json([
            'success' => true,
            'message' => 'Your request has been received. Our team will get back to you soon.',
            'data' => [
                'ticket_number' => $ticket->ticket_number,
                'status' => $ticket->status,
            ],
        ], 201);
    }

    /**
     * Store only the provided context fields, enriched with the request's
     * user agent and IP so support can see how the visitor arrived.
     */
    protected function normalizeContext(array $context, Request $request): ?array
    {
        $clean = array_filter([
            'search_query' => $context['search_query'] ?? null,
            'attempted_article' => $context['attempted_article'] ?? null,
            'current_page' => $context['current_page'] ?? null,
            'user_id' => isset($context['user_id']) ? (int) $context['user_id'] : null,
            'device' => $context['device'] ?? null,
            'user_agent' => $request->userAgent(),
            'ip_address' => $request->ip() ? hash('sha256', (string) $request->ip()) : null,
        ], fn ($value) => $value !== null && $value !== '');

        return $clean === [] ? null : $clean;
    }
}
