<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Creative;
use App\Models\Advertiser;
use App\Models\Campaign;
use App\Models\AdLedgerTransaction;

class AdminController extends Controller
{
    /**
     * Get all pending creatives.
     */
    public function getPendingCreatives()
    {
        // In a real system, we'd paginate this and load advertiser details.
        $creatives = Creative::with('advertiser')->where('status', 'pending')->get();
        return response()->json(['data' => $creatives]);
    }

    /**
     * Moderate a creative (approve or reject).
     */
    public function moderateCreative(Request $request, $id)
    {
        $request->validate([
            'action' => 'required|in:approve,reject'
        ]);

        $creative = Creative::findOrFail($id);
        
        $creative->status = $request->input('action') === 'approve' ? 'approved' : 'rejected';
        $creative->save();

        return response()->json(['message' => "Creative {$creative->status} successfully", 'data' => $creative]);
    }

    /**
     * Get all advertisers waiting for verification.
     */
    public function getPendingAdvertisers()
    {
        $advertisers = Advertiser::whereIn('verification_status', ['unverified', 'basic'])->get();
        return response()->json(['data' => $advertisers]);
    }

    /**
     * Verify an advertiser.
     */
    public function verifyAdvertiser(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:identity_verified,business_verified'
        ]);

        $advertiser = Advertiser::findOrFail($id);
        
        $advertiser->verification_status = $request->input('status');
        $advertiser->save();

        return response()->json(['message' => "Advertiser verified successfully", 'data' => $advertiser]);
    }
    /**
     * Get all campaigns globally.
     */
    public function getCampaigns()
    {
        $campaigns = Campaign::with('advertiser')->orderBy('created_at', 'desc')->get();
        
        $mapped = $campaigns->map(function($c) {
            return [
                'id' => $c->id,
                'name' => $c->name,
                'status' => strtolower($c->status),
                'review_status' => $c->review_status ?? 'pending',
                'review_notes' => $c->review_notes,
                'total_budget' => $c->total_budget,
                'created_at' => $c->created_at,
                'user' => [
                    'name' => $c->advertiser ? $c->advertiser->business_name : 'Unknown',
                    'role' => 'Advertiser'
                ]
            ];
        });

        return response()->json(['data' => $mapped]);
    }

    /**
     * Get global campaign stats.
     */
    public function getCampaignStats()
    {
        $total = Campaign::count();
        $active = Campaign::where('status', 'ACTIVE')->count();
        $pending = Campaign::where('review_status', 'pending')->count();
        
        return response()->json([
            'total_campaigns' => $total,
            'active_campaigns' => $active,
            'pending_review' => $pending
        ]);
    }

    /**
     * Get global revenue stats.
     */
    public function getRevenue()
    {
        $totalSpendCents = AdLedgerTransaction::where('type', 'debit')->sum('amount');
        $activeCampaigns = Campaign::where('status', 'ACTIVE')->count();

        return response()->json([
            'total_revenue' => abs($totalSpendCents) / 100,
            'active_campaigns' => $activeCampaigns
        ]);
    }

    /**
     * Moderate a campaign (approve, reject, suspend, remove).
     */
    public function moderateCampaign(Request $request, $id, $action)
    {
        if (!in_array($action, ['approve', 'reject', 'suspend', 'remove'])) {
            return response()->json(['error' => 'Invalid action'], 400);
        }

        $campaign = Campaign::findOrFail($id);
        
        if ($action === 'remove') {
            $campaign->delete();
            return response()->json(['message' => 'Campaign deleted successfully']);
        }
        
        if (in_array($action, ['approve', 'reject', 'suspend'])) {
            if ($action === 'suspend') {
                $campaign->status = 'PAUSED';
            }
            if ($action === 'approve') {
                $campaign->review_status = 'approved';
                $campaign->status = 'ACTIVE';
            }
            if ($action === 'reject') {
                $campaign->review_status = 'rejected';
            }
            
            if ($request->has('reason')) {
                $campaign->review_notes = $request->input('reason');
            }
            
            $campaign->save();
        }

        return response()->json(['message' => "Action $action completed"]);
    }
}
