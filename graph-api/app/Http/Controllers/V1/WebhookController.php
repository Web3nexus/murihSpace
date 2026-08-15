<?php

namespace App\Http\Controllers\V1;

use Illuminate\Routing\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use App\Models\DeveloperApp;
use App\Models\WebhookSubscription;
use App\Jobs\DispatchWebhookJob;
use Illuminate\Support\Str;

/**
 * Phase 5: Webhooks Ingest & Dispatch.
 *
 * GET /v1/webhooks            — list active webhooks for developer's apps
 * POST /v1/webhooks           — subscribe a URL to platform events
 * DELETE /v1/webhooks/{id}    — unsubscribe a webhook
 * POST /v1/webhooks/dispatch  — test or dispatch a webhook event to subscribers
 */
class WebhookController extends Controller
{
    public const SUPPORTED_EVENTS = [
        'user.registered',
        'user.updated',
        'post.created',
        'post.deleted',
        'business.created',
        'product.created',
        'order.completed',
        'campaign.created',
        'ad.approved',
        'ticket.created',
        'ticket.updated',
    ];

    /** GET /v1/webhooks */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');

        $appIds = DeveloperApp::where('user_id', $userId)->pluck('id');
        $subs   = WebhookSubscription::whereIn('developer_app_id', $appIds)->get();

        return response()->json([
            'data' => $subs->map(fn ($s) => $this->formatWebhook($s)),
            'meta' => ['supported_events' => self::SUPPORTED_EVENTS],
        ]);
    }

    /** POST /v1/webhooks */
    public function store(Request $request): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');

        $validated = $request->validate([
            'app_id'   => ['required', 'string'],
            'url'      => ['required', 'url'],
            'events'   => ['required', 'array', 'min:1'],
            'events.*' => ['string', 'in:' . implode(',', self::SUPPORTED_EVENTS)],
        ]);

        $app = DeveloperApp::where('user_id', $userId)
            ->where(fn ($q) => $q->where('id', $validated['app_id'])->orWhere('app_id', $validated['app_id']))
            ->firstOrFail();

        $sub = WebhookSubscription::create([
            'developer_app_id' => $app->id,
            'url'              => $validated['url'],
            'events'           => $validated['events'],
            'is_active'        => true,
        ]);

        return response()->json([
            'data'    => $this->formatWebhook($sub, true),
            'message' => 'Webhook subscription created. Store the webhook secret for signature verification.',
        ], 201);
    }

    /** DELETE /v1/webhooks/{id} */
    public function destroy(Request $request, string $id): JsonResponse
    {
        $userId = $request->attributes->get('graph_user_id');

        $appIds = DeveloperApp::where('user_id', $userId)->pluck('id');
        $sub    = WebhookSubscription::whereIn('developer_app_id', $appIds)
            ->where(fn ($q) => $q->where('id', $id)->orWhere('subscription_id', $id))
            ->firstOrFail();

        $sub->delete();

        return response()->json(null, 204);
    }

    /** POST /v1/webhooks/dispatch — trigger event delivery */
    public function dispatch(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'event_type' => ['required', 'string', 'in:' . implode(',', self::SUPPORTED_EVENTS)],
            'data'       => ['required', 'array'],
        ]);

        $eventEnvelope = [
            'event_id'       => 'evt_' . Str::random(16),
            'event_type'     => $validated['event_type'],
            'version'        => 1,
            'occurred_at'    => now()->toIso8601String(),
            'producer'       => 'murihspace-graph-api',
            'correlation_id' => $request->header('X-Request-ID', 'req_' . Str::uuid()),
            'data'           => $validated['data'],
        ];

        // Find active subscriptions that listen for this event_type
        $subscriptions = WebhookSubscription::where('is_active', true)->get()
            ->filter(fn ($sub) => in_array($validated['event_type'], $sub->events ?? [], true));

        foreach ($subscriptions as $sub) {
            DispatchWebhookJob::dispatch($sub->url, $sub->secret, $eventEnvelope);
        }

        return response()->json([
            'data' => [
                'event_id'          => $eventEnvelope['event_id'],
                'event_type'        => $eventEnvelope['event_type'],
                'subscribers_queued'=> $subscriptions->count(),
            ],
            'message' => 'Webhook event dispatched to subscribers.',
        ]);
    }

    private function formatWebhook(WebhookSubscription $sub, bool $includeSecret = false): array
    {
        $res = [
            'id'              => $sub->subscription_id,
            'type'            => 'webhook_subscription',
            'app_id'          => $sub->developerApp?->app_id,
            'url'             => $sub->url,
            'events'          => $sub->events,
            'is_active'       => $sub->is_active,
            'created_at'      => $sub->created_at?->toIso8601String(),
        ];

        if ($includeSecret) {
            $res['secret'] = $sub->secret;
        }

        return $res;
    }
}
