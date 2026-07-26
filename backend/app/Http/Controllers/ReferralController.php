<?php

namespace App\Http\Controllers;

use App\Models\Referral;
use App\Models\ReferralLink;
use App\Models\ReferralProgram;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ReferralController extends Controller
{
    // ── Program ──────────────────────────────────────────────────────────

    public function program(Request $request): JsonResponse
    {
        $program = ReferralProgram::where('creator_id', $request->user()->id)->first();

        return response()->json(['data' => $program]);
    }

    public function upsertProgram(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'is_active' => ['sometimes', 'boolean'],
            'reward_type' => ['sometimes', 'in:credit,percentage,fixed'],
            'reward_value' => ['sometimes', 'integer', 'min:1', 'max:1000000'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        $program = ReferralProgram::updateOrCreate(
            ['creator_id' => $request->user()->id],
            $validated,
        );

        return response()->json(['data' => $program]);
    }

    // ── Links ────────────────────────────────────────────────────────────

    public function links(Request $request): JsonResponse
    {
        $links = ReferralLink::where('creator_id', $request->user()->id)
            ->withCount('referrals')
            ->latest()
            ->get()
            ->map(fn ($l) => [
                'id' => $l->id,
                'code' => $l->code,
                'url' => url("/ref/{$l->code}"),
                'clicks' => $l->clicks,
                'referrals_count' => $l->referrals_count,
                'is_active' => $l->is_active,
                'created_at' => $l->created_at->toIso8601String(),
                'program' => $l->program ? [
                    'reward_type' => $l->program->reward_type,
                    'reward_value' => $l->program->reward_value,
                ] : null,
            ]);

        return response()->json(['data' => $links]);
    }

    public function createLink(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:50', 'alpha_dash', 'unique:referral_links,code'],
        ]);

        $code = $validated['code'] ?? strtoupper(Str::random(8));

        $program = ReferralProgram::where('creator_id', $request->user()->id)->first();

        $link = ReferralLink::create([
            'creator_id' => $request->user()->id,
            'referral_program_id' => $program?->id,
            'code' => $code,
        ]);

        return response()->json([
            'data' => [
                'id' => $link->id,
                'code' => $link->code,
                'url' => url("/ref/{$link->code}"),
                'clicks' => 0,
                'referrals_count' => 0,
                'is_active' => true,
                'created_at' => $link->created_at->toIso8601String(),
            ],
        ], 201);
    }

    public function toggleLink(Request $request, int $id): JsonResponse
    {
        $link = ReferralLink::where('creator_id', $request->user()->id)->findOrFail($id);
        $link->update(['is_active' => ! $link->is_active]);

        return response()->json(['data' => $link->fresh()]);
    }

    public function deleteLink(Request $request, int $id): JsonResponse
    {
        $link = ReferralLink::where('creator_id', $request->user()->id)->findOrFail($id);
        $link->delete();

        return response()->json(['message' => 'Link deleted.']);
    }

    // ── Stats & Referrals ───────────────────────────────────────────────

    public function stats(Request $request): JsonResponse
    {
        $creatorId = $request->user()->id;
        $linkIds = ReferralLink::where('creator_id', $creatorId)->pluck('id');

        $totalClicks = ReferralLink::where('creator_id', $creatorId)->sum('clicks');
        $totalSignups = Referral::whereIn('referral_link_id', $linkIds)->where('type', 'signup')->count();
        $totalPurchases = Referral::whereIn('referral_link_id', $linkIds)->where('type', 'purchase')->count();
        $totalRewards = Referral::whereIn('referral_link_id', $linkIds)->where('reward_paid', true)->sum('reward_amount');
        $pendingRewards = Referral::whereIn('referral_link_id', $linkIds)->where('reward_paid', false)->sum('reward_amount');

        return response()->json([
            'data' => [
                'total_clicks' => $totalClicks,
                'total_signups' => $totalSignups,
                'total_purchases' => $totalPurchases,
                'total_rewards' => $totalRewards,
                'pending_rewards' => $pendingRewards,
                'conversion_rate' => $totalClicks > 0 ? round(($totalSignups / $totalClicks) * 100, 1) : 0,
            ],
        ]);
    }

    public function referrals(Request $request): JsonResponse
    {
        $linkIds = ReferralLink::where('creator_id', $request->user()->id)->pluck('id');

        $referrals = Referral::whereIn('referral_link_id', $linkIds)
            ->with(['link:id,code', 'referredUser:id,name,username'])
            ->latest()
            ->get()
            ->map(fn ($r) => [
                'id' => $r->id,
                'type' => $r->type,
                'code' => $r->link?->code,
                'referred_user' => $r->referredUser ? ['name' => $r->referredUser->name, 'username' => $r->referredUser->username] : null,
                'reward_amount' => $r->reward_amount,
                'reward_paid' => $r->reward_paid,
                'converted_at' => $r->converted_at?->toIso8601String(),
                'created_at' => $r->created_at->toIso8601String(),
            ]);

        return response()->json(['data' => $referrals]);
    }

    // ── Public: Track click ─────────────────────────────────────────────

    public function trackClick(Request $request, string $code): JsonResponse
    {
        $link = ReferralLink::where('code', $code)->where('is_active', true)->first();

        if (! $link) {
            return response()->json(['message' => 'Invalid referral link.'], 404);
        }

        $link->increment('clicks');

        Referral::create([
            'referral_link_id' => $link->id,
            'type' => 'click',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json(['message' => 'Referral tracked.', 'creator_id' => $link->creator_id]);
    }
}
