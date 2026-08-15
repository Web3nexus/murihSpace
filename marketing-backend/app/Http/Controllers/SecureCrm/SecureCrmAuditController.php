<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\StaffUser;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\View\View;

class SecureCrmAuditController extends Controller
{
    /**
     * GET /securecrm/audit — read-only list of audit entries.
     */
    public function index(Request $request): View
    {
        $logs = AuditLog::query()
            ->with('staffUser')
            ->search($request->query('q'))
            ->forAction($request->query('action'))
            ->forActor($request->filled('actor') ? (int) $request->query('actor') : null)
            ->orderByDesc('created_at')
            ->paginate(25)
            ->withQueryString();

        return view('securecrm.audit.index', [
            'logs' => $logs,
            'groups' => $this->actionGroups(),
            'actors' => StaffUser::query()->orderBy('name')->get(),
            'filters' => $request->query(),
        ]);
    }

    /**
     * Grouped action options for the filter dropdown, preserving action keys
     * inside each group so the "action" filter submits the real action value.
     *
     * @return Collection<string, array<string, string>>
     */
    protected function actionGroups(): Collection
    {
        $groups = [];

        foreach (AuditLog::LABELS as $action => $label) {
            $groups[str($action)->before('.')->toString()][$action] = $label;
        }

        return collect($groups);
    }
}
