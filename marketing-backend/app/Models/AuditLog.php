<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Immutable record of a sensitive staff action in SecureCRM. Entries are
 * written by AuditLogService and never edited or deleted through the UI —
 * normal support agents cannot modify them.
 */
class AuditLog extends Model
{
    use HasFactory;

    public const LOGIN = 'staff.login';

    public const LOGOUT = 'staff.logout';

    public const STAFF_PERMISSIONS = 'staff.permissions';

    public const TICKET_VIEW = 'ticket.view';

    public const TICKET_ASSIGN = 'ticket.assign';

    public const TICKET_TEAM_ASSIGN = 'ticket.team_assign';

    public const CUSTOMER_PROFILE_VIEW = 'customer.profile.view';

    public const CUSTOMER_INTERNAL_LOOKUP = 'customer.internal.lookup';

    public const KYC_VIEW = 'kyc.view';

    public const HELP_PUBLISH = 'help.publish';

    public const HELP_UNPUBLISH = 'help.unpublish';

    public const HELP_ARCHIVE = 'help.archive';

    public const HELP_RESTORE = 'help.restore';

    public const CMS_PUBLISH = 'cms.publish';

    public const CMS_UNPUBLISH = 'cms.unpublish';

    public const CMS_ARCHIVE = 'cms.archive';

    public const CMS_RESTORE = 'cms.restore';

    public const SLA_CREATE = 'sla.create';

    public const SLA_UPDATE = 'sla.update';

    public const SLA_TOGGLE = 'sla.toggle';

    public const SLA_DELETE = 'sla.delete';

    public const REFUND_ESCALATE = 'refund.escalate';

    /**
     * Human-readable labels for every auditable action.
     */
    public const LABELS = [
        self::LOGIN => 'Staff login',
        self::LOGOUT => 'Staff logout',
        self::STAFF_PERMISSIONS => 'Permission change',
        self::TICKET_VIEW => 'Ticket accessed',
        self::TICKET_ASSIGN => 'Ticket reassigned',
        self::TICKET_TEAM_ASSIGN => 'Ticket assigned to team',
        self::CUSTOMER_PROFILE_VIEW => 'Customer profile accessed',
        self::CUSTOMER_INTERNAL_LOOKUP => 'Internal data lookup',
        self::KYC_VIEW => 'KYC record viewed',
        self::HELP_PUBLISH => 'Help article published',
        self::HELP_UNPUBLISH => 'Help article unpublished',
        self::HELP_ARCHIVE => 'Help article archived',
        self::HELP_RESTORE => 'Help article restored',
        self::CMS_PUBLISH => 'CMS content published',
        self::CMS_UNPUBLISH => 'CMS content unpublished',
        self::CMS_ARCHIVE => 'CMS content archived',
        self::CMS_RESTORE => 'CMS content restored',
        self::SLA_CREATE => 'SLA policy created',
        self::SLA_UPDATE => 'SLA policy updated',
        self::SLA_TOGGLE => 'SLA policy toggled',
        self::SLA_DELETE => 'SLA policy deleted',
        self::REFUND_ESCALATE => 'Refund escalated',
    ];

    protected $fillable = [
        'staff_user_id', 'action', 'subject_type', 'subject_id', 'subject_reference',
        'before', 'after', 'reason', 'ip_address', 'user_agent', 'metadata',
    ];

    protected $casts = [
        'before' => 'array',
        'after' => 'array',
        'metadata' => 'array',
    ];

    public function staffUser(): BelongsTo
    {
        return $this->belongsTo(StaffUser::class, 'staff_user_id');
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        return $query->when($term, function (Builder $q) use ($term) {
            $q->where(function (Builder $inner) use ($term) {
                $inner->where('action', 'like', "%{$term}%")
                    ->orWhere('subject_reference', 'like', "%{$term}%")
                    ->orWhereHas('staffUser', fn (Builder $u) => $u->where('name', 'like', "%{$term}%"));
            });
        });
    }

    public function scopeForAction(Builder $query, ?string $action): Builder
    {
        return $query->when($action, fn (Builder $q) => $q->where('action', $action));
    }

    public function scopeForActor(Builder $query, ?int $staffUserId): Builder
    {
        return $query->when($staffUserId, fn (Builder $q) => $q->where('staff_user_id', $staffUserId));
    }

    public function scopeForSubject(Builder $query, ?string $subjectType): Builder
    {
        return $query->when($subjectType, fn (Builder $q) => $q->where('subject_type', $subjectType));
    }

    /**
     * The domain this action belongs to (e.g. "ticket", "cms").
     */
    public function group(): string
    {
        return str($this->action)->before('.')->toString();
    }

    public function actionLabel(): string
    {
        return self::LABELS[$this->action] ?? str_replace('_', ' ', ucfirst($this->action));
    }

    /**
     * Flatten scalar before/after differences for compact list display.
     *
     * @return array<int, array{field: string, before: mixed, after: mixed}>
     */
    public function changes(int $limit = 6): array
    {
        $before = (array) ($this->before ?? []);
        $after = (array) ($this->after ?? []);
        $keys = array_unique(array_merge(array_keys($before), array_keys($after)));

        $changes = [];

        foreach ($keys as $key) {
            $old = $before[$key] ?? null;
            $new = $after[$key] ?? null;

            if (is_array($old) || is_array($new)) {
                continue;
            }

            if ($old === $new) {
                continue;
            }

            $changes[] = ['field' => (string) $key, 'before' => $old, 'after' => $new];

            if (count($changes) >= $limit) {
                break;
            }
        }

        return $changes;
    }
}
