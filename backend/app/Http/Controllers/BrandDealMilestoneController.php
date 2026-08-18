<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BrandDealMilestoneController extends Controller
{
    /**
     * Get all milestones for a brand deal.
     */
    public function index(Request $request, $dealId): JsonResponse
    {
        // Mocked database milestone retrieval with production schema structure
        $milestones = [
            [
                'id' => 101,
                'deal_id' => (int) $dealId,
                'title' => 'Milestone 1: Concept Script & Storyboard',
                'description' => 'Deliver draft video script and visual storyboard for brand review',
                'amount' => 300.00,
                'currency' => 'USD',
                'due_date' => '2026-09-01',
                'status' => 'approved_and_released', // pending, funded_in_escrow, submitted_for_review, approved_and_released, disputed
                'proof_notes' => 'Storyboard PDF submitted via chat link.',
                'proof_url' => 'https://murihspace.com/storage/proofs/storyboard_v1.pdf',
                'escrow_held' => false,
                'dispute_reason' => null,
            ],
            [
                'id' => 102,
                'deal_id' => (int) $dealId,
                'title' => 'Milestone 2: Final Video Editing & Publication',
                'description' => 'Produce 4K video reel and publish to Instagram & TikTok channels',
                'amount' => 700.00,
                'currency' => 'USD',
                'due_date' => '2026-09-15',
                'status' => 'submitted_for_review',
                'proof_notes' => 'Reel published: https://instagram.com/p/C982xyz',
                'proof_url' => 'https://instagram.com/p/C982xyz',
                'escrow_held' => true,
                'dispute_reason' => null,
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $milestones,
            'summary' => [
                'total_deal_amount' => 1000.00,
                'funded_in_escrow' => 700.00,
                'released_amount' => 300.00,
            ],
        ]);
    }

    /**
     * Create a new milestone for a brand deal.
     */
    public function store(Request $request, $dealId): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'amount' => ['required', 'numeric', 'min:5'],
            'due_date' => ['required', 'date'],
        ]);

        $milestone = [
            'id' => rand(200, 999),
            'deal_id' => (int) $dealId,
            'title' => $validated['title'],
            'description' => $validated['description'] ?? '',
            'amount' => (float) $validated['amount'],
            'currency' => 'USD',
            'due_date' => $validated['due_date'],
            'status' => 'funded_in_escrow',
            'proof_notes' => null,
            'proof_url' => null,
            'escrow_held' => true,
            'created_at' => now()->toIso8601String(),
        ];

        return response()->json([
            'success' => true,
            'message' => 'Milestone created & funded into escrow successfully.',
            'data' => $milestone,
        ], 201);
    }

    /**
     * Creator submits deliverable proof for a milestone.
     */
    public function submit(Request $request, $milestoneId): JsonResponse
    {
        $validated = $request->validate([
            'proof_notes' => ['required', 'string', 'max:2000'],
            'proof_url' => ['nullable', 'url'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Deliverable proof submitted. Brand notified for review and escrow approval.',
            'data' => [
                'id' => (int) $milestoneId,
                'status' => 'submitted_for_review',
                'proof_notes' => $validated['proof_notes'],
                'proof_url' => $validated['proof_url'] ?? null,
                'submitted_at' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Brand approves deliverable & releases escrow funds to Creator.
     */
    public function approve(Request $request, $milestoneId): JsonResponse
    {
        return response()->json([
            'success' => true,
            'message' => 'Milestone approved! Escrow funds released directly to creator wallet.',
            'data' => [
                'id' => (int) $milestoneId,
                'status' => 'approved_and_released',
                'escrow_held' => false,
                'released_at' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Party raises a dispute on a milestone.
     */
    public function dispute(Request $request, $milestoneId): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Dispute raised. Admin & Staff moderation team notified to review chat log and proofs.',
            'data' => [
                'id' => (int) $milestoneId,
                'status' => 'disputed',
                'dispute_reason' => $validated['reason'],
                'disputed_at' => now()->toIso8601String(),
            ],
        ]);
    }

    /**
     * Admin/Staff List all disputed brand deal milestones.
     */
    public function adminDisputesIndex(Request $request): JsonResponse
    {
        $disputes = [
            [
                'id' => 881,
                'milestone_id' => 102,
                'deal_title' => 'Pulse Activewear Creator Campaign',
                'brand_name' => 'Pulse Activewear Ltd',
                'creator_name' => 'Vincent (Creator)',
                'amount' => 700.00,
                'currency' => 'USD',
                'status' => 'disputed',
                'dispute_reason' => 'Brand claims video length was shorter than contracted 60 seconds.',
                'creator_notes' => 'Video delivered at 58 seconds with full branding overlay.',
                'proof_url' => 'https://instagram.com/p/C982xyz',
                'chat_conversation_id' => 402,
                'disputed_at' => now()->subDays(1)->toIso8601String(),
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $disputes,
        ]);
    }

    /**
     * Admin/Staff resolve a disputed milestone.
     */
    public function adminResolveDispute(Request $request, $milestoneId): JsonResponse
    {
        $validated = $request->validate([
            'resolution' => ['required', 'in:release_to_creator,refund_to_brand'],
            'admin_notes' => ['required', 'string', 'max:2000'],
        ]);

        $status = $validated['resolution'] === 'release_to_creator' ? 'approved_and_released' : 'refunded';

        return response()->json([
            'success' => true,
            'message' => "Dispute resolved by Admin ({$validated['resolution']}). Escrow status updated to {$status}.",
            'data' => [
                'milestone_id' => (int) $milestoneId,
                'resolution' => $validated['resolution'],
                'status' => $status,
                'admin_notes' => $validated['admin_notes'],
                'resolved_at' => now()->toIso8601String(),
            ],
        ]);
    }
}
