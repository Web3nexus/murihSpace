<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\SupportNote;
use App\Models\Ticket;
use App\Services\MainBackendService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SecureCrmCustomerController extends Controller
{
    public function __construct(
        protected MainBackendService $backend
    ) {}

    /**
     * GET /securecrm/customers?q=...
     */
    public function index(Request $request): View
    {
        $q = trim((string) $request->query('q', ''));

        $paginator = Ticket::query()
            ->selectRaw('customer_email, max(customer_name) as customer_name')
            ->selectRaw('count(*) as tickets')
            ->selectRaw("sum(case when status not in ('resolved','closed') then 1 else 0 end) as open")
            ->whereNotNull('customer_email')
            ->when($q !== '', fn ($query) => $query->where(fn ($w) => $w
                ->where('customer_email', 'like', "%{$q}%")
                ->orWhere('customer_name', 'like', "%{$q}%")))
            ->groupBy('customer_email')
            ->orderBy('customer_email')
            ->paginate(50);

        $customers = collect($paginator->items())->map(fn ($row) => [
            'email' => $row->customer_email,
            'name' => $row->customer_name,
            'tickets' => $row->tickets,
            'open' => $row->open,
        ]);

        return view('securecrm.customers.index', [
            'customers' => $customers,
            'q' => $q,
            'total' => $paginator->total(),
        ]);
    }

    /**
     * GET /securecrm/customers/{email}
     */
    public function show(string $email): View
    {
        $user = $this->backend->userByEmail($email);
        $userId = $user['data']['id'] ?? null;

        $profile = $userId !== null ? $this->backend->userSummary((int) $userId) : null;
        $orders = $userId !== null ? $this->backend->userOrders((int) $userId) : null;
        $subscriptions = $userId !== null ? $this->backend->userSubscriptions((int) $userId) : null;
        $wallet = $userId !== null ? $this->backend->userWalletSummary((int) $userId) : null;
        $kyc = $userId !== null ? $this->backend->userKycSummary((int) $userId) : null;
        $transactions = $userId !== null ? $this->backend->userTransactions((int) $userId) : null;

        $tickets = Ticket::query()
            ->forEmail($email)
            ->with(['category', 'assignedAgent'])
            ->orderByDesc('created_at')
            ->get();

        $notes = SupportNote::query()
            ->where('customer_email', $email)
            ->with('staffUser')
            ->orderByDesc('created_at')
            ->get();

        return view('securecrm.customers.show', [
            'email' => $email,
            'user' => $user['data'] ?? null,
            'has_data' => $userId !== null,
            'profile' => $profile['data'] ?? null,
            'orders' => $orders['data'] ?? [],
            'subscriptions' => $subscriptions['data'] ?? [],
            'wallet' => $wallet['data'] ?? null,
            'kyc' => $kyc['data'] ?? null,
            'transactions' => $transactions['data'] ?? [],
            'tickets' => $tickets,
            'notes' => $notes,
        ]);
    }

    /**
     * POST /securecrm/customers/{email}/notes
     */
    public function storeNote(string $email, Request $request): RedirectResponse
    {
        abort_unless($request->user('staff')?->hasPermission('customer.notes.create'), 403);

        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        SupportNote::create([
            'customer_email' => $email,
            'staff_user_id' => $request->user('staff')->id,
            'body' => $validated['body'],
        ]);

        return back()->with('status', 'Note saved on this customer.');
    }
}
