<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SecureCrmAnnouncementController extends Controller
{
    public function index(Request $request): View
    {
        $announcements = Announcement::query()
            ->when($request->filled('state'), fn ($q) => $q->where('state', $request->query('state')))
            ->orderByDesc('updated_at')
            ->paginate(50)
            ->withQueryString();

        return view('securecrm.announcements.index', [
            'announcements' => $announcements,
            'states' => Announcement::STATES,
        ]);
    }

    public function create(): View
    {
        return view('securecrm.announcements.form', ['announcement' => null]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'featured' => ['nullable', 'boolean'],
        ]);

        $announcement = Announcement::create([
            'title' => $validated['title'],
            'body' => $validated['body'] ?? null,
            'featured' => (bool) ($validated['featured'] ?? false),
            'state' => 'draft',
            'created_by_type' => get_class($request->user('staff')),
            'created_by_id' => $request->user('staff')->id,
        ]);

        return redirect()
            ->route('securecrm.announcements.edit', $announcement)
            ->with('status', 'Announcement draft created.');
    }

    public function edit(Announcement $announcement): View
    {
        return view('securecrm.announcements.form', ['announcement' => $announcement]);
    }

    public function update(Request $request, Announcement $announcement): RedirectResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'string'],
            'featured' => ['nullable', 'boolean'],
        ]);

        $announcement->update([
            'title' => $validated['title'],
            'body' => $validated['body'] ?? null,
            'featured' => (bool) ($validated['featured'] ?? false),
        ]);

        return redirect()
            ->route('securecrm.announcements.edit', $announcement)
            ->with('status', 'Announcement updated.');
    }

    public function publish(Request $request, Announcement $announcement): RedirectResponse
    {
        if ($announcement->state === 'archived') {
            return back()->with('error', 'Archived announcements must be restored before publishing.');
        }

        $announcement->update(['state' => 'published', 'published_at' => now(), 'scheduled_at' => null, 'archived_at' => null]);

        return back()->with('status', 'Announcement published.');
    }

    public function unpublish(Request $request, Announcement $announcement): RedirectResponse
    {
        $announcement->update(['state' => 'draft', 'published_at' => null, 'scheduled_at' => null]);

        return back()->with('status', 'Announcement unpublished.');
    }

    public function schedule(Request $request, Announcement $announcement): RedirectResponse
    {
        $validated = $request->validate([
            'scheduled_at' => ['required', 'date', 'after:now'],
        ]);

        $announcement->update([
            'state' => 'scheduled',
            'scheduled_at' => $validated['scheduled_at'],
            'published_at' => null,
            'archived_at' => null,
        ]);

        return back()->with('status', 'Announcement scheduled.');
    }

    public function archive(Request $request, Announcement $announcement): RedirectResponse
    {
        $announcement->update(['state' => 'archived', 'archived_at' => now(), 'scheduled_at' => null]);

        return back()->with('status', 'Announcement archived.');
    }

    public function restore(Request $request, Announcement $announcement): RedirectResponse
    {
        $announcement->update(['state' => 'draft', 'archived_at' => null]);

        return back()->with('status', 'Announcement restored as draft.');
    }

    public function destroy(Request $request, Announcement $announcement): RedirectResponse
    {
        $announcement->delete();

        return redirect()
            ->route('securecrm.announcements')
            ->with('status', 'Announcement deleted.');
    }
}
