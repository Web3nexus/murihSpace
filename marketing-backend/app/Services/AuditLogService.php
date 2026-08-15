<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\StaffUser;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Writes immutable audit entries for sensitive SecureCRM actions.
 *
 * Actor, IP and device (user agent) are captured from the current request
 * automatically; call sites only supply the action plus any subject and
 * before/after context. Audit records are never edited or deleted through
 * the application.
 */
class AuditLogService
{
    public function __construct(
        protected Request $request
    ) {}

    /**
     * Record a single audit entry. Named arguments shape the context:
     * actor, subject, subject_type, subject_id, subject_reference, before,
     * after, reason, ip, user_agent, metadata.
     *
     * @param  string  $action  one of the AuditLog::* action constants
     */
    public function record(string $action, mixed ...$context): AuditLog
    {
        $actor = $context['actor'] ?? $this->request->user('staff');
        $ip = $context['ip'] ?? $this->request->ip();
        $userAgent = $context['user_agent'] ?? $this->request->userAgent();

        $subject = $context['subject'] ?? null;
        $subjectType = $context['subject_type'] ?? ($subject instanceof Model ? $subject->getMorphClass() : null);
        $subjectId = $context['subject_id'] ?? ($subject instanceof Model ? $subject->getKey() : null);

        return AuditLog::create([
            'staff_user_id' => $actor instanceof StaffUser ? $actor->id : null,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId === null ? null : (int) $subjectId,
            'subject_reference' => $context['subject_reference'] ?? null,
            'before' => $context['before'] ?? null,
            'after' => $context['after'] ?? null,
            'reason' => $context['reason'] ?? null,
            'ip_address' => $ip,
            'user_agent' => $userAgent !== null ? substr((string) $userAgent, 0, 512) : null,
            'metadata' => $context['metadata'] ?? null,
        ]);
    }
}
