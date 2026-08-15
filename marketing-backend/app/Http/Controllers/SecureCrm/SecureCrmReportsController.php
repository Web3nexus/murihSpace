<?php

namespace App\Http\Controllers\SecureCrm;

use App\Http\Controllers\Controller;
use App\Services\SupportAnalyticsService;
use Illuminate\View\View;

class SecureCrmReportsController extends Controller
{
    public function __invoke(SupportAnalyticsService $analytics): View
    {
        return view('securecrm.reports.index', [
            'metrics' => $analytics->snapshot(),
        ]);
    }
}
