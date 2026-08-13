<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\AnnouncementResource;
use App\Models\Announcement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PublicAnnouncementController extends Controller
{
    /**
     * GET /api/public/announcements
     *
     * Published announcements (featured first).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $announcements = Announcement::query()
            ->published()
            ->orderByDesc('featured')
            ->orderByDesc('published_at')
            ->paginate(max(1, min((int) $request->query('per_page', 20), 100)));

        return AnnouncementResource::collection($announcements);
    }
}
