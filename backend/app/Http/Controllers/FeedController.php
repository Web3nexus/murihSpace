<?php

namespace App\Http\Controllers;

use App\Models\FeedWeight;
use App\Models\FeedAlgorithmConfig;
use App\Models\FeedAlgorithmChange;
use App\Models\FeedBoost;
use App\Models\FeedAbTest;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class FeedController extends Controller
{
    public function rankedFeed(Request $request): JsonResponse
    {
        $user = $request->user();
        $feedType = $request->input('feed_type', 'home');
        $page = $request->input('page', 1);

        $weights = FeedWeight::active($feedType)->get()->keyBy('signal_name');

        $posts = Post::with(['author:id,name,username,avatar,verification_badge_status,verification_badge_expires_at', 'community:id,name,slug,logo_url', 'reactions'])
            ->published()
            ->where(function ($q) {
                $q->whereNull('scheduled_at')->orWhere('scheduled_at', '<=', now());
            });

        if ($feedType === 'following') {
            $followingIds = $user->follows()->pluck('following_id');
            $posts->whereIn('user_id', $followingIds);
        }

        if ($feedType === 'community') {
            $communityIds = $user->communities()->pluck('communities.id');
            $posts->whereIn('community_id', $communityIds);
        }

        $posts = $posts->orderBy('created_at', 'desc')->paginate(20);
        return response()->json($posts);
    }

    public function weights(Request $request): JsonResponse
    {
        $feedType = $request->input('feed_type', 'home');
        $weights = FeedWeight::where('feed_type', $feedType)->orderBy('group')->orderBy('signal_name')->get();
        return response()->json($weights);
    }

    public function updateWeight(Request $request, int $id): JsonResponse
    {
        $weight = FeedWeight::findOrFail($id);
        $oldWeight = $weight->weight;
        $oldActive = $weight->is_active;

        $validated = $request->validate([
            'weight' => ['sometimes', 'numeric', 'min:0', 'max:999.9999'],
            'is_active' => ['sometimes', 'boolean'],
            'reason' => ['required', 'string', 'max:500'],
            'is_temporary' => ['nullable', 'boolean'],
            'expires_at' => ['nullable', 'date', 'after:now'],
        ]);

        $weight->update(array_filter([
            'weight' => $validated['weight'] ?? $weight->weight,
            'is_active' => $validated['is_active'] ?? $weight->is_active,
        ]));

        FeedAlgorithmChange::create([
            'admin_id' => $request->user()->id,
            'action' => 'update_weight',
            'feed_type' => $weight->feed_type,
            'signal_name' => $weight->signal_name,
            'previous_weight' => $oldWeight,
            'new_weight' => $weight->weight,
            'previous_active' => $oldActive,
            'new_active' => $weight->is_active,
            'reason' => $validated['reason'],
            'is_temporary' => $validated['is_temporary'] ?? false,
            'expires_at' => $validated['expires_at'] ?? null,
        ]);

        return response()->json(['message' => 'Weight updated.', 'weight' => $weight->fresh()]);
    }

    public function configs(Request $request): JsonResponse
    {
        $configs = FeedAlgorithmConfig::all();
        return response()->json($configs);
    }

    public function updateConfig(Request $request, int $id): JsonResponse
    {
        $config = FeedAlgorithmConfig::findOrFail($id);
        $validated = $request->validate([
            'config' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'stage' => ['sometimes', Rule::in(FeedAlgorithmConfig::STAGES)],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $config->update($validated);

        FeedAlgorithmChange::create([
            'admin_id' => $request->user()->id,
            'action' => 'update_config',
            'feed_type' => $config->feed_type,
            'reason' => $validated['reason'],
        ]);

        return response()->json(['message' => 'Config updated.', 'config' => $config->fresh()]);
    }

    public function promoteToProduction(Request $request, int $id): JsonResponse
    {
        $config = FeedAlgorithmConfig::findOrFail($id);
        $previous = $config->stage;
        $config->update(['stage' => 'production']);

        FeedAlgorithmChange::create([
            'admin_id' => $request->user()->id,
            'action' => 'promote_to_production',
            'feed_type' => $config->feed_type,
            'reason' => $request->input('reason', 'Promoted to production.'),
        ]);

        return response()->json(['message' => 'Promoted to production.', 'config' => $config->fresh()]);
    }

    public function rollback(Request $request, int $id): JsonResponse
    {
        $config = FeedAlgorithmConfig::findOrFail($id);
        $config->update(['stage' => 'development']);

        FeedAlgorithmChange::create([
            'admin_id' => $request->user()->id,
            'action' => 'rollback',
            'feed_type' => $config->feed_type,
            'reason' => $request->input('reason', 'Rolled back.'),
        ]);

        return response()->json(['message' => 'Rolled back to development.']);
    }

    public function boosts(Request $request): JsonResponse
    {
        return response()->json(FeedBoost::with('admin:id,name')->current()->latest()->get());
    }

    public function storeBoost(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'boostable_type' => ['required', 'string'],
            'boostable_id' => ['required', 'integer'],
            'boost_factor' => ['required', 'numeric', 'min:0.1', 'max:10'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        $boost = FeedBoost::create([
            'boost_factor' => $validated['boost_factor'],
            'starts_at' => $validated['starts_at'] ?? now(),
            'ends_at' => $validated['ends_at'] ?? null,
            'admin_id' => $request->user()->id,
            'reason' => $validated['reason'],
        ]);

        $boost->boostable()->associate(
            app($validated['boostable_type'])::findOrFail($validated['boostable_id'])
        );
        $boost->save();

        return response()->json(['message' => 'Boost created.', 'boost' => $boost->load('admin:id,name')], 201);
    }

    public function removeBoost(Request $request, int $id): JsonResponse
    {
        $boost = FeedBoost::findOrFail($id);
        $boost->update(['is_active' => false, 'ends_at' => now()]);

        FeedAlgorithmChange::create([
            'admin_id' => $request->user()->id,
            'action' => 'remove_boost',
            'reason' => $request->input('reason', 'Boost removed.'),
        ]);

        return response()->json(['message' => 'Boost removed.']);
    }

    public function changes(Request $request): JsonResponse
    {
        $changes = FeedAlgorithmChange::with('admin:id,name')
            ->latest()
            ->paginate(30);
        return response()->json($changes);
    }

    public function seedDefaultWeights(Request $request): JsonResponse
    {
        $defaultsPerFeed = [
            'home' => [
                ['post_recency', 15.0, 'Post Recency'],
                ['friend_relationship', 10.0, 'Friend Relationship'],
                ['follower_relationship', 12.0, 'Follower Relationship'],
                ['community_relationship', 8.0, 'Community Relationship'],
                ['likes', 6.0, 'Likes'],
                ['dislikes', -2.0, 'Dislikes'],
                ['comments', 5.0, 'Comments'],
                ['shares', 8.0, 'Shares'],
                ['saves', 7.0, 'Saves'],
                ['video_watch_time', 4.0, 'Video Watch Time'],
                ['content_diversity', 9.0, 'Content Diversity'],
                ['trending_score', 5.0, 'Trending Score'],
                ['new_creator_boost', 3.0, 'New Creator Boost'],
                ['sponsored_frequency', 3.0, 'Sponsored Frequency'],
                ['creator_trust_score', 4.0, 'Creator Trust Score'],
                ['language_relevance', 6.0, 'Language Relevance'],
                ['location_relevance', 3.0, 'Location Relevance'],
            ],
            'following' => [
                ['post_recency', 20.0, 'Post Recency'],
                ['likes', 4.0, 'Likes'],
                ['comments', 3.0, 'Comments'],
                ['shares', 5.0, 'Shares'],
                ['video_watch_time', 3.0, 'Video Watch Time'],
            ],
            'trending' => [
                ['trending_score', 25.0, 'Trending Score'],
                ['likes', 10.0, 'Likes'],
                ['shares', 10.0, 'Shares'],
                ['comments', 8.0, 'Comments'],
                ['post_recency', 5.0, 'Post Recency'],
            ],
        ];

        foreach ($defaultsPerFeed as $feedType => $signals) {
            foreach ($signals as [$signal, $weight, $label]) {
                FeedWeight::firstOrCreate(
                    ['feed_type' => $feedType, 'signal_name' => $signal],
                    ['weight' => $weight, 'label' => $label, 'is_active' => true]
                );
            }
        }

        foreach (['home', 'following', 'trending', 'community', 'recommended'] as $ft) {
            FeedAlgorithmConfig::firstOrCreate(
                ['feed_type' => $ft],
                ['label' => ucfirst($ft) . ' Feed', 'stage' => 'production', 'is_active' => true]
            );
        }

        return response()->json(['message' => 'Default weights seeded.']);
    }

    public function abTests(Request $request): JsonResponse
    {
        return response()->json(FeedAbTest::with('creator:id,name')->latest()->get());
    }

    public function storeAbTest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'feed_type' => ['required', Rule::in(FeedWeight::FEED_TYPES)],
            'control_config' => ['required', 'array'],
            'variant_config' => ['required', 'array'],
            'traffic_percentage' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $test = FeedAbTest::create([
            'name' => $validated['name'],
            'feed_type' => $validated['feed_type'],
            'control_config' => $validated['control_config'],
            'variant_config' => $validated['variant_config'],
            'traffic_percentage' => $validated['traffic_percentage'] ?? 50,
            'status' => 'draft',
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'A/B test created.', 'test' => $test], 201);
    }

    public function startAbTest(Request $request, int $id): JsonResponse
    {
        $test = FeedAbTest::findOrFail($id);
        $test->update(['status' => 'running', 'started_at' => now()]);

        FeedAlgorithmChange::create([
            'admin_id' => $request->user()->id,
            'action' => 'start_ab_test',
            'feed_type' => $test->feed_type,
            'reason' => "Started A/B test: {$test->name}",
        ]);

        return response()->json(['message' => 'A/B test started.', 'test' => $test]);
    }

    public function endAbTest(Request $request, int $id): JsonResponse
    {
        $test = FeedAbTest::findOrFail($id);
        $test->update(['status' => 'completed', 'ended_at' => now()]);
        return response()->json(['message' => 'A/B test ended.', 'test' => $test]);
    }
}
