<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Models\Ticket;
use App\Models\TicketCategory;
use App\Services\SlaService;
use App\Services\TicketAutomationEngine;
use App\Services\TicketConversationService;
use App\Services\TicketNotifier;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PublicCustomerTicketController extends Controller
{
    public function __construct(
        protected TicketConversationService $conversation
    ) {}

    private function customerEmail(Request $request): string
    {
        $email = $request->attributes->get('_customer_email');

        abort_if(! is_string($email) || $email === '', 401);

        return $email;
    }

    private function scopeToCustomer(Request $request): Builder
    {
        return Ticket::query()->forEmail($this->customerEmail($request));
    }

    /**
     * GET /api/customer/ticket-categories
     * Categories available to customers when creating a ticket.
     */
    public function categories(): JsonResponse
    {
        $categories = TicketCategory::query()
            ->whereNull('parent_id')
            ->with('children')
            ->orderBy('sort_order')
            ->get()
            ->map(fn ($category) => [
                'id' => $category->id,
                'name' => $category->name,
                'slug' => $category->slug,
                'children' => $category->children->map(fn ($child) => [
                    'id' => $child->id,
                    'name' => $child->name,
                    'slug' => $child->slug,
                ]),
            ]);

        return response()->json([
            'success' => true,
            'data' => $categories,
        ]);
    }

    /**
     * GET /api/customer/tickets
     * List all tickets belonging to the authenticated customer.
     */
    public function index(Request $request): JsonResponse
    {
        $status = $request->query('status');
        $tickets = $this->scopeToCustomer($request)
            ->when($status && $status !== 'all', fn ($q) => $q->status($status))
            ->with(['category'])
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (Ticket $ticket) => $this->summary($ticket));

        return response()->json([
            'success' => true,
            'data' => $tickets,
        ]);
    }

    /**
     * POST /api/customer/tickets
     * Create a new ticket from the app.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['required', 'string', 'max:10000'],
            'category_id' => ['nullable', 'integer', 'exists:ticket_categories,id'],
            'priority' => ['nullable', Rule::in(Ticket::PRIORITIES)],
            'attachment' => ['nullable', 'file', 'max:5120', 'mimes:jpg,jpeg,png,gif,pdf,doc,docx,txt,csv'],
        ]);

        $email = $this->customerEmail($request);

        $ticket = DB::transaction(function () use ($validated, $email) {
            $ticket = Ticket::create([
                'ticket_number' => Ticket::generateTicketNumber(),
                'customer_email' => $email,
                'subject' => $validated['subject'],
                'description' => $validated['description'],
                'category_id' => $validated['category_id'] ?? null,
                'priority' => $validated['priority'] ?? 'normal',
                'status' => 'new',
                'channel' => 'app',
            ]);

            (new TicketAutomationEngine)->apply($ticket, 'created');
            (new SlaService)->assignPolicy($ticket);

            if (! empty($validated['attachment'])) {
                $ticket->attachments()->create([
                    'original_name' => $validated['attachment']->getClientOriginalName(),
                    'stored_name' => $validated['attachment']->store('ticket-attachments', 'local'),
                    'mime_type' => $validated['attachment']->getMimeType(),
                    'size' => $validated['attachment']->getSize(),
                ]);
            }

            return $ticket;
        });

        app(TicketNotifier::class)->ticketCreated($ticket);

        return response()->json([
            'success' => true,
            'message' => 'Your ticket has been created.',
            'data' => $this->detail($ticket),
        ], 201);
    }

    /**
     * GET /api/customer/tickets/{ticket}
     * Show the ticket with customer-visible messages and events.
     */
    public function show(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorizeAccess($request, $ticket);
        $ticket->load(['category', 'messages', 'attachments']);

        return response()->json([
            'success' => true,
            'data' => $this->detail($ticket),
        ]);
    }

    /**
     * POST /api/customer/tickets/{ticket}/reply
     * Customer replies to the ticket.
     */
    public function reply(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorizeAccess($request, $ticket);

        if (in_array($ticket->status, ['resolved', 'closed'], true)) {
            throw ValidationException::withMessages([
                'ticket' => ['This ticket is closed. Reopen it before replying.'],
            ]);
        }

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:10000'],
        ]);

        $message = $this->conversation->addMessage($ticket, 'customer_message', $validated['body']);

        if ($ticket->status === 'pending_customer') {
            $this->conversation->changeStatus($ticket, 'open');
        }

        return response()->json([
            'success' => true,
            'message' => 'Reply sent.',
            'data' => [
                'id' => $message->id,
                'body' => $message->body,
                'created_at' => $message->created_at->toISOString(),
            ],
        ]);
    }

    /**
     * POST /api/customer/tickets/{ticket}/status
     * Close a resolved ticket or reopen it.
     */
    public function status(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorizeAccess($request, $ticket);

        $validated = $request->validate([
            'status' => ['required', Rule::in(['closed', 'reopened'])],
        ]);

        if ($validated['status'] === 'closed') {
            if (! in_array($ticket->status, ['resolved', 'open', 'pending_customer', 'reopened'], true)) {
                throw ValidationException::withMessages([
                    'status' => ['This ticket cannot be closed in its current state.'],
                ]);
            }
            $this->conversation->changeStatus($ticket, 'closed');
            $this->conversation->recordEvent($ticket, 'customer_closed');
        } else {
            $this->conversation->changeStatus($ticket, 'reopened');
            $this->conversation->recordEvent($ticket, 'customer_reopened');
        }

        return response()->json([
            'success' => true,
            'message' => "Ticket {$validated['status']}.",
            'data' => ['status' => $ticket->refresh()->status],
        ]);
    }

    /**
     * POST /api/customer/tickets/{ticket}/rate
     * Rate a resolved/closed ticket.
     */
    public function rate(Request $request, Ticket $ticket): JsonResponse
    {
        $this->authorizeAccess($request, $ticket);

        if (! in_array($ticket->status, ['resolved', 'closed'], true)) {
            throw ValidationException::withMessages([
                'ticket' => ['Only resolved or closed tickets can be rated.'],
            ]);
        }

        if ($ticket->rating !== null) {
            throw ValidationException::withMessages([
                'ticket' => ['This ticket has already been rated.'],
            ]);
        }

        $validated = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $ticket->forceFill([
            'rating' => $validated['rating'],
            'rating_comment' => $validated['comment'] ?? null,
            'rated_at' => now(),
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Thanks for your feedback.',
            'data' => ['rating' => $ticket->rating],
        ]);
    }

    private function authorizeAccess(Request $request, Ticket $ticket): void
    {
        if ($ticket->customer_email !== $this->customerEmail($request)) {
            abort(404);
        }
    }

    private function summary(Ticket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'ticket_number' => $ticket->ticket_number,
            'subject' => $ticket->subject,
            'description' => $ticket->description,
            'status' => $ticket->status,
            'priority' => $ticket->priority,
            'category' => $ticket->category?->name,
            'created_at' => $ticket->created_at->toISOString(),
            'updated_at' => $ticket->updated_at->toISOString(),
            'message_count' => $ticket->messages->where('type', '!=', 'internal_note')->count(),
            'has_rating' => $ticket->rating !== null,
        ];
    }

    private function detail(Ticket $ticket): array
    {
        $messages = $ticket->messages
            ->filter(fn ($m) => $m->type !== 'internal_note')
            ->values()
            ->map(fn ($m) => [
                'id' => $m->id,
                'type' => $m->type,
                'body' => $m->body,
                'author' => $m->type === 'customer_message' ? 'customer' : 'support',
                'created_at' => $m->created_at->toISOString(),
            ]);

        $events = $ticket->events
            ->filter(fn ($e) => ! in_array($e->event, ['note_added'], true))
            ->values()
            ->map(fn ($e) => [
                'event' => $e->event,
                'old_value' => $e->old_value,
                'new_value' => $e->new_value,
                'created_at' => $e->created_at->toISOString(),
            ]);

        return [
            'id' => $ticket->id,
            'ticket_number' => $ticket->ticket_number,
            'subject' => $ticket->subject,
            'description' => $ticket->description,
            'status' => $ticket->status,
            'priority' => $ticket->priority,
            'category' => $ticket->category?->name,
            'created_at' => $ticket->created_at->toISOString(),
            'updated_at' => $ticket->updated_at->toISOString(),
            'resolved_at' => $ticket->resolved_at?->toISOString(),
            'closed_at' => $ticket->closed_at?->toISOString(),
            'rating' => $ticket->rating,
            'rating_comment' => $ticket->rating_comment,
            'rated_at' => $ticket->rated_at?->toISOString(),
            'messages' => $messages,
            'events' => $events,
            'attachments' => $ticket->attachments->map(fn ($a) => [
                'id' => $a->id,
                'original_name' => $a->original_name,
            ]),
        ];
    }
}
