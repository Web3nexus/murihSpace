<?php

namespace App\Http\Controllers;

use App\Models\AccountAppeal;
use App\Models\AuditLog;
use App\Models\Report;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Appeals from suspended accounts. A suspended person cannot sign in, so the appeal is
 * filed from the sign-in screen with the phone number. The account team decides.
 */
class AccountAppealController extends Controller
{
    /**
     * Public. Files an appeal for a suspended account. The response is the same whether or
     * not the number belongs to a suspended account, so it cannot be used to find them.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone_e164' => ['required', 'string', 'regex:/^\+[1-9]\d{1,14}$/'],
            // The appeal must come from someone who also knows the account's email. A phone number alone
            // is not enough to file an appeal for someone else.
            'email' => ['required', 'string', 'email', 'max:255'],
            'message' => ['required', 'string', 'min:20', 'max:2000'],
        ]);

        $user = User::where('mobile_number', $validated['phone_e164'])
            ->where('status', 'suspended')
            ->first();

        $emailMatches = $user && $user->email !== null
            && strtolower($user->email) === strtolower($validated['email']);

        if ($emailMatches && ! AccountAppeal::where('user_id', $user->id)->where('status', AccountAppeal::STATUS_PENDING)->exists()) {
            AccountAppeal::create([
                'user_id' => $user->id,
                'message' => $validated['message'],
                'status' => AccountAppeal::STATUS_PENDING,
            ]);
        }

        return response()->json([
            'message' => 'Thank you. If this number belongs to a suspended account, the account team will review your appeal and contact you by email.',
        ], 202);
    }

    /** Account team: the queue of appeals, with how often the account was reported. */
    public function index(Request $request): JsonResponse
    {
        $status = (string) $request->input('status', AccountAppeal::STATUS_PENDING);

        $appeals = AccountAppeal::with('user:id,name,username,email,status,suspension_reason,suspension_source,suspended_at')
            ->where('status', $status)
            ->oldest()
            ->paginate(25);

        $appeals->getCollection()->transform(function (AccountAppeal $appeal) {
            $appeal->setAttribute('reports_count', Report::where('reported_type', 'user')
                ->where('reported_id', $appeal->user_id)
                ->where('status', '!=', 'dismissed')
                ->count());

            return $appeal;
        });

        return response()->json($appeals);
    }

    /**
     * Account team: approve (reinstate the account) or reject (ban it for good).
     */
    public function decide(Request $request, AccountAppeal $appeal, NotificationService $notifications): JsonResponse
    {
        $validated = $request->validate([
            'decision' => ['required', 'string', 'in:approve,reject'],
            'review_note' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($appeal->status !== AccountAppeal::STATUS_PENDING) {
            return response()->json(['message' => 'This appeal has already been decided.'], 409);
        }

        $actor = $request->user();
        $user = User::withTrashed()->findOrFail($appeal->user_id);
        $approved = $validated['decision'] === 'approve';

        DB::transaction(function () use ($appeal, $user, $actor, $validated, $approved) {
            if ($approved) {
                $user->update([
                    'status' => 'active',
                    'suspended_at' => null,
                    'suspension_reason' => null,
                    'suspension_source' => null,
                ]);

                // The reports that led to the suspension have been reviewed and cleared. Dismissing
                // them stops the same reports from suspending the account again straight away.
                Report::where('reported_type', 'user')
                    ->where('reported_id', $user->id)
                    ->where('status', '!=', 'dismissed')
                    ->update([
                        'status' => 'dismissed',
                        'review_note' => 'Cleared when the account suspension was approved on appeal.',
                    ]);
            } else {
                // A rejected appeal ends the account for good. It cannot be appealed again.
                $user->update([
                    'status' => 'banned',
                    'suspension_source' => 'appeal_rejected',
                ]);
            }

            $appeal->update([
                'status' => $approved ? AccountAppeal::STATUS_APPROVED : AccountAppeal::STATUS_REJECTED,
                'reviewed_by' => $actor->id,
                'reviewed_at' => now(),
                'review_note' => $validated['review_note'] ?? null,
            ]);

            AuditLog::create([
                'user_id' => $actor->id,
                'action' => $approved ? 'user.appeal_approved' : 'user.appeal_rejected',
                'resource_type' => 'user',
                'resource_id' => (string) $user->id,
                'metadata' => ['appeal_id' => $appeal->id, 'note' => $validated['review_note'] ?? null],
            ]);
        });

        // The decision is saved already. A failed email must not turn it into an error response.
        try {
            if ($approved) {
                $notifications->actionEmail(
                    user: $user,
                    title: 'Your account has been reinstated',
                    bodyHtml: '<p>Your appeal was approved and your MurihSpace account is active again. You can sign in with your phone number.</p>',
                );
            } else {
                $notifications->actionEmail(
                    user: $user,
                    title: 'Your appeal was not approved',
                    bodyHtml: '<p>After review, your appeal was not approved and your MurihSpace account has been permanently disabled.</p>',
                    footnote: 'This decision is final.',
                );
            }
        } catch (\Throwable $e) {
            report($e);
        }

        return response()->json([
            'message' => $approved ? 'Account reinstated.' : 'Account permanently disabled.',
            'data' => $appeal->fresh(),
        ]);
    }
}
