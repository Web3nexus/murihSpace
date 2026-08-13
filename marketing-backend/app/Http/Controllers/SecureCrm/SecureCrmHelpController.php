<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\HelpArticle;
use App\Models\HelpArticleRevision;
use App\Models\HelpAttachment;
use App\Models\HelpCategory;
use App\Services\HelpContentService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SecureCrmHelpController extends Controller
{
    public function __construct(
        protected HelpContentService $content
    ) {}

    public function index(Request $request): View
    {
        $articles = HelpArticle::query()
            ->with(['category', 'revisions'])
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = trim((string) $request->query('q'));
                $q->where(function ($w) use ($term) {
                    $w->where('title', 'ilike', "%{$term}%")
                        ->orWhere('excerpt', 'ilike', "%{$term}%")
                        ->orWhere('slug', 'ilike', "%{$term}%");
                });
            })
            ->when($request->filled('state'), fn ($q) => $q->where('state', $request->query('state')))
            ->when($request->filled('category'), fn ($q) => $q->where('category_id', (int) $request->query('category')))
            ->when($request->boolean('featured'), fn ($q) => $q->where('featured', true))
            ->orderByDesc('updated_at')
            ->paginate(25)
            ->withQueryString();

        return view('securecrm.help.index', [
            'articles' => $articles,
            'categories' => HelpCategory::query()->orderBy('sort_order')->orderBy('name')->get(),
            'states' => HelpContentService::STATES,
            'stateCounts' => [
                'all' => HelpArticle::count(),
                'draft' => HelpArticle::where('state', 'draft')->count(),
                'review' => HelpArticle::where('state', 'review')->count(),
                'scheduled' => HelpArticle::where('state', 'scheduled')->count(),
                'published' => HelpArticle::where('state', 'published')->count(),
                'archived' => HelpArticle::where('state', 'archived')->count(),
            ],
        ]);
    }

    public function create(): View
    {
        return view('securecrm.help.form', [
            'article' => null,
            'categories' => $this->categoryOptions(),
            'articles' => HelpArticle::query()->orderBy('title')->get(),
            'states' => HelpContentService::STATES,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validated($request);
        $article = $this->content->create($data, $request->user('staff'), $data['note'] ?? null);

        return redirect()
            ->route('securecrm.help.show', $article)
            ->with('status', "Help article \"{$article->title}\" created as draft.");
    }

    public function show(HelpArticle $article): View
    {
        return view('securecrm.help.show', [
            'article' => $article->load(['category', 'revisions', 'attachments', 'relatedArticles', 'feedback']),
            'states' => HelpContentService::STATES,
        ]);
    }

    public function edit(HelpArticle $article): View
    {
        return view('securecrm.help.form', [
            'article' => $article->load(['relatedArticles']),
            'categories' => $this->categoryOptions(),
            'articles' => HelpArticle::query()
                ->where('id', '!=', $article->id)
                ->orderBy('title')
                ->get(),
            'states' => HelpContentService::STATES,
        ]);
    }

    public function update(Request $request, HelpArticle $article): RedirectResponse
    {
        $data = $this->validated($request);
        $this->content->update($article, $data, $request->user('staff'), $data['note'] ?? null);

        return redirect()
            ->route('securecrm.help.show', $article)
            ->with('status', "Help article \"{$article->title}\" updated.");
    }

    /**
     * Render the article the way the public would see it (staff-only preview).
     */
    public function preview(HelpArticle $article): View
    {
        return view('securecrm.help.preview', ['article' => $article->load('category')]);
    }

    public function publish(Request $request, HelpArticle $article): RedirectResponse
    {
        if ($article->state === 'archived') {
            return back()->with('error', 'Archived articles must be restored before publishing.');
        }

        $this->content->transition($article, 'published');

        return back()->with('status', "Help article \"{$article->title}\" published.");
    }

    public function unpublish(Request $request, HelpArticle $article): RedirectResponse
    {
        $this->content->transition($article, 'draft');

        return back()->with('status', "Help article \"{$article->title}\" unpublished.");
    }

    public function schedule(Request $request, HelpArticle $article): RedirectResponse
    {
        $validated = $request->validate([
            'scheduled_at' => ['required', 'date', 'after:now'],
        ]);

        $this->content->schedule($article, $validated['scheduled_at']);

        return back()->with('status', "Help article \"{$article->title}\" scheduled.");
    }

    public function archive(Request $request, HelpArticle $article): RedirectResponse
    {
        $this->content->transition($article, 'archived');

        return back()->with('status', "Help article \"{$article->title}\" archived.");
    }

    public function restore(Request $request, HelpArticle $article): RedirectResponse
    {
        $this->content->transition($article, 'draft');

        return back()->with('status', "Help article \"{$article->title}\" restored as draft.");
    }

    public function restoreRevision(Request $request, HelpArticle $article, HelpArticleRevision $revision): RedirectResponse
    {
        if ($revision->article_id !== $article->id) {
            abort(404);
        }

        $this->content->restoreRevision($article, $revision, $request->user('staff'));

        return back()->with('status', "Help article \"{$article->title}\" restored to revision #{$revision->revision_number}.");
    }

    // ── Categories ────────────────────────────────────────────────

    public function categories(): View
    {
        return view('securecrm.help.categories', [
            'categories' => HelpCategory::query()
                ->withCount('articles')
                ->with(['children' => fn ($q) => $q->withCount('articles')])
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(),
        ]);
    }

    public function storeCategory(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', 'alpha_dash'],
            'blurb' => ['nullable', 'string', 'max:500'],
            'parent_id' => ['nullable', 'integer', 'exists:help_categories,id'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'featured' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $slug = Str::slug($validated['slug'] ?? $validated['name']);

        if (HelpCategory::where('slug', $slug)->exists()) {
            return back()->withInput()->withErrors(['slug' => 'That category slug is already taken.']);
        }

        HelpCategory::create([
            'name' => $validated['name'],
            'slug' => $slug,
            'blurb' => $validated['blurb'] ?? null,
            'parent_id' => $validated['parent_id'] ?? null,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'featured' => (bool) ($validated['featured'] ?? false),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return back()->with('status', 'Help category created.');
    }

    public function updateCategory(Request $request, HelpCategory $category): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'slug' => ['nullable', 'string', 'max:120', 'alpha_dash'],
            'blurb' => ['nullable', 'string', 'max:500'],
            'parent_id' => ['nullable', 'integer', 'exists:help_categories,id', Rule::notIn([$category->id])],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'featured' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $slug = Str::slug($validated['slug'] ?? $validated['name']);

        if (HelpCategory::where('slug', $slug)->where('id', '!=', $category->id)->exists()) {
            return back()->withInput()->withErrors(['slug' => 'That category slug is already taken.']);
        }

        $category->update([
            'name' => $validated['name'],
            'slug' => $slug,
            'blurb' => $validated['blurb'] ?? null,
            'parent_id' => $validated['parent_id'] ?? null,
            'sort_order' => (int) ($validated['sort_order'] ?? 0),
            'featured' => (bool) ($validated['featured'] ?? false),
            'is_active' => (bool) ($validated['is_active'] ?? true),
        ]);

        return back()->with('status', 'Help category updated.');
    }

    public function destroyCategory(HelpCategory $category): RedirectResponse
    {
        if ($category->articles()->exists()) {
            return back()->with('error', 'This category still contains articles. Move or delete them first.');
        }

        $category->delete();

        return back()->with('status', 'Help category deleted.');
    }

    // ── Attachments ───────────────────────────────────────────────

    public function storeAttachment(Request $request, HelpArticle $article): RedirectResponse
    {
        $validated = $request->validate([
            'attachment' => ['required', 'file', 'max:10240'],
        ]);

        $file = $validated['attachment'];
        $filename = Str::of($file->getClientOriginalName())
            ->replaceMatches('/[^A-Za-z0-9._-]+/', '-')
            ->toString();

        $path = $file->storeAs(
            "help/{$article->id}",
            "{$article->id}-".time().'-'.$filename,
            'local',
        );

        HelpAttachment::create([
            'article_id' => $article->id,
            'disk' => 'local',
            'path' => $path,
            'filename' => $filename,
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]);

        return back()->with('status', 'Attachment added.');
    }

    public function destroyAttachment(HelpAttachment $attachment): RedirectResponse
    {
        Storage::disk($attachment->disk)->delete($attachment->path);
        $attachment->delete();

        return back()->with('status', 'Attachment removed.');
    }

    public function downloadAttachment(HelpAttachment $attachment): BinaryFileResponse|StreamedResponse
    {
        if (! Storage::disk($attachment->disk)->exists($attachment->path)) {
            abort(404);
        }

        return Storage::disk($attachment->disk)->download($attachment->path, $attachment->filename);
    }

    // ── Helpers ───────────────────────────────────────────────────

    protected function categoryOptions()
    {
        return HelpCategory::query()->orderBy('sort_order')->orderBy('name')->get();
    }

    protected function validated(Request $request): array
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer', 'exists:help_categories,id'],
            'title' => ['required', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:255', 'alpha_dash'],
            'excerpt' => ['nullable', 'string', 'max:1000'],
            'body' => ['nullable', 'string'],
            'sections' => ['nullable', 'array', 'max:30'],
            'sections.*.heading' => ['nullable', 'string', 'max:255'],
            'sections.*.body' => ['nullable', 'string'],
            'keywords_text' => ['nullable', 'string', 'max:2000'],
            'tags_text' => ['nullable', 'string', 'max:2000'],
            'featured' => ['nullable', 'boolean'],
            'seo_title' => ['nullable', 'string', 'max:160'],
            'seo_description' => ['nullable', 'string', 'max:300'],
            'canonical_url' => ['nullable', 'string', 'max:500'],
            'related' => ['nullable', 'array'],
            'related.*' => ['integer'],
            'note' => ['nullable', 'string', 'max:1000'],
        ]);

        $data['keywords'] = $this->splitList($request->string('keywords_text')->toString());
        $data['tags'] = $this->splitList($request->string('tags_text')->toString());
        $data['sections'] = $this->normalizeSections($request->input('sections'));

        return $data;
    }

    protected function splitList(string $value): ?array
    {
        $parts = collect(preg_split('/[,;\n]+/', $value))
            ->map(fn ($item) => Str::limit(trim($item), 100, ''))
            ->filter()
            ->unique()
            ->values()
            ->all();

        return $parts ?: null;
    }

    protected function normalizeSections(?array $sections): ?array
    {
        if (! $sections) {
            return null;
        }

        $normalized = collect($sections)
            ->map(fn ($section) => [
                'heading' => trim((string) ($section['heading'] ?? '')),
                'body' => trim((string) ($section['body'] ?? '')),
            ])
            ->filter(fn ($section) => $section['heading'] !== '' || $section['body'] !== '')
            ->values()
            ->all();

        return $normalized ?: null;
    }
}
