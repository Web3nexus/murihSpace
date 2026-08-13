<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Models\HelpArticle;
use App\Models\HelpArticleFeedback;
use App\Models\HelpCategory;
use App\Models\HelpSearchTerm;
use App\Models\StaffUser;
use App\Models\Ticket;
use Illuminate\View\View;

class SecureCrmOverviewController extends Controller
{
    public function __invoke(): View
    {
        $publishedArticles = HelpArticle::query()->published()->count();

        $feedbackCounts = HelpArticleFeedback::query()
            ->selectRaw('count(*) as total')
            ->selectRaw('count(*) filter (where helpful) as helpful')
            ->selectRaw('count(*) filter (where not helpful) as not_helpful')
            ->first();

        $topCategories = HelpCategory::query()
            ->whereNull('parent_id')
            ->withCount(['articles' => fn ($q) => $q->published()])
            ->orderByDesc('articles_count')
            ->limit(6)
            ->get();

        $recentArticles = HelpArticle::query()
            ->published()
            ->with('category')
            ->latest('published_at')
            ->limit(6)
            ->get();

        $latestSearches = HelpSearchTerm::query()
            ->orderByDesc('created_at')
            ->limit(6)
            ->get();

        $topSearches = HelpSearchTerm::query()
            ->select('query')
            ->selectRaw('count(*) as hits')
            ->groupBy('query')
            ->orderByDesc('hits')
            ->limit(6)
            ->get();

        $agentCount = StaffUser::query()->where('is_active', true)->count();

        $kpi = [
            'published_articles' => $publishedArticles,
            'total_feedback' => (int) $feedbackCounts->total,
            'helpful' => (int) $feedbackCounts->helpful,
            'not_helpful' => (int) $feedbackCounts->not_helpful,
            'top_searches' => (int) $topSearches->sum('hits'),
            'article_views' => (int) HelpArticle::query()->sum('view_count'),
            'agent_count' => $agentCount,
            'open_tickets' => (int) Ticket::query()->open()->count(),
            'new_tickets' => (int) Ticket::query()->status('new')->count(),
        ];

        return view('securecrm.overview', [
            'kpi' => $kpi,
            'topCategories' => $topCategories,
            'recentArticles' => $recentArticles,
            'latestSearches' => $latestSearches,
            'topSearches' => $topSearches,
        ]);
    }
}
