<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\CmsContent;
use App\Models\CmsContentRevision;
use App\Services\CmsContentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class SecureCrmCmsController extends Controller
{
    protected array $sections;

    public function __construct(
        protected CmsContentService $content
    ) {
        $this->sections = config('cms.sections', []);
    }

    public function index(Request $request): View
    {
        $active = $this->resolveSection($request->query('section', array_key_first($this->sections)));

        $items = CmsContent::query()
            ->where('section', $active)
            ->with('revisions')
            ->orderBy('sort_order')
            ->orderByDesc('updated_at')
            ->paginate(50)
            ->withQueryString();

        return view('securecrm.cms.index', [
            'sections' => $this->sections,
            'active' => $active,
            'items' => $items,
            'states' => CmsContentService::STATES,
        ]);
    }

    public function create(Request $request): View
    {
        $section = $this->resolveSection($request->query('section'));

        return view('securecrm.cms.form', [
            'section' => $section,
            'definition' => $this->sections[$section],
            'item' => null,
            'states' => CmsContentService::STATES,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $section = $this->resolveSection($request->query('section'));
        $data = $this->validated($request, $section);

        $item = $this->content->create($section, $data, $request->user('staff'), $data['note'] ?? null);

        return redirect()
            ->route('securecrm.cms.show', ['cms' => $item, 'section' => $section])
            ->with('status', 'Content created as draft.');
    }

    public function show(Request $request, CmsContent $cms): View
    {
        $section = $this->resolveSection($request->query('section', $cms->section));

        return view('securecrm.cms.show', [
            'section' => $section,
            'definition' => $this->sections[$section],
            'item' => $cms->load(['revisions']),
            'states' => CmsContentService::STATES,
            'staff' => $request->user('staff'),
        ]);
    }

    public function edit(Request $request, CmsContent $cms): View
    {
        $section = $this->resolveSection($request->query('section', $cms->section));

        return view('securecrm.cms.form', [
            'section' => $section,
            'definition' => $this->sections[$section],
            'item' => $cms,
            'states' => CmsContentService::STATES,
        ]);
    }

    public function update(Request $request, CmsContent $cms): RedirectResponse
    {
        $section = $this->resolveSection($request->query('section', $cms->section));
        $data = $this->validated($request, $section);

        $this->content->update($cms, $data, $request->user('staff'), $data['note'] ?? null);

        return redirect()
            ->route('securecrm.cms.show', ['cms' => $cms, 'section' => $section])
            ->with('status', 'Content updated.');
    }

    /**
     * Render the content item the way the public would see it.
     */
    public function preview(Request $request, CmsContent $cms): View
    {
        $section = $this->resolveSection($request->query('section', $cms->section));

        return view('securecrm.cms.preview', [
            'section' => $section,
            'definition' => $this->sections[$section],
            'item' => $cms,
        ]);
    }

    public function publish(Request $request, CmsContent $cms): RedirectResponse
    {
        if ($cms->state === 'archived') {
            return back()->with('error', 'Archived content must be restored before publishing.');
        }

        $this->content->transition($cms, 'published');

        return back()->with('status', 'Content published.');
    }

    public function unpublish(Request $request, CmsContent $cms): RedirectResponse
    {
        $this->content->transition($cms, 'draft');

        return back()->with('status', 'Content unpublished.');
    }

    public function schedule(Request $request, CmsContent $cms): RedirectResponse
    {
        $validated = $request->validate([
            'scheduled_at' => ['required', 'date', 'after:now'],
        ]);

        $this->content->schedule($cms, $validated['scheduled_at']);

        return back()->with('status', 'Content scheduled.');
    }

    public function archive(Request $request, CmsContent $cms): RedirectResponse
    {
        $this->content->transition($cms, 'archived');

        return back()->with('status', 'Content archived.');
    }

    public function restore(Request $request, CmsContent $cms): RedirectResponse
    {
        $this->content->transition($cms, 'draft');

        return back()->with('status', 'Content restored as draft.');
    }

    public function restoreRevision(Request $request, CmsContent $cms, CmsContentRevision $revision): RedirectResponse
    {
        if ($revision->content_id !== $cms->id) {
            abort(404);
        }

        $this->content->restoreRevision($cms, $revision, $request->user('staff'));

        return back()->with('status', "Content restored to revision #{$revision->revision_number}.");
    }

    // ── Helpers ───────────────────────────────────────────────────

    protected function resolveSection(?string $section): string
    {
        $section = (string) ($section ?? array_key_first($this->sections));

        if (! isset($this->sections[$section])) {
            abort(404, "Unknown CMS section: {$section}");
        }

        return $section;
    }

    protected function validated(Request $request, string $section): array
    {
        $definition = $this->sections[$section];

        $data = $request->validate([
            'slug' => ['nullable', 'string', 'max:255', 'alpha_dash'],
            'title' => ['nullable', 'string', 'max:255'],
            'excerpt' => ['nullable', 'string', 'max:1000'],
            'body' => ['nullable', 'string'],
            'content' => ['nullable', 'array'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'seo_title' => ['nullable', 'string', 'max:160'],
            'seo_description' => ['nullable', 'string', 'max:300'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $data['content'] = $this->normalizeContent($data['content'] ?? [], $definition);

        return $data;
    }

    protected function normalizeContent(array $raw, array $definition): ?array
    {
        $normalized = [];

        foreach ($definition['fields'] ?? [] as $field) {
            $key = $field['key'];
            $value = $raw[$key] ?? null;

            $normalized[$key] = match ($field['type'] ?? 'text') {
                'list' => $this->splitLines((string) $value),
                'boolean' => (bool) $value,
                'textarea' => $value !== null ? trim((string) $value) : null,
                default => $value !== null && $value !== '' ? trim((string) $value) : null,
            };
        }

        return $normalized ?: null;
    }

    protected function splitLines(?string $value): ?array
    {
        $parts = collect(preg_split('/[\r\n]+/', (string) $value))
            ->map(fn ($line) => trim($line))
            ->filter()
            ->values()
            ->all();

        return $parts ?: null;
    }
}
