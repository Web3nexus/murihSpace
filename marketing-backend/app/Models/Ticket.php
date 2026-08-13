<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Ticket extends Model
{
    use HasFactory;

    public const PRIORITIES = ['low', 'normal', 'high', 'urgent', 'critical'];

    public const STATUSES = [
        'new', 'open', 'pending_customer', 'pending_internal',
        'escalated', 'resolved', 'closed', 'reopened',
    ];

    public const CHANNELS = [
        'help_center_form', 'app', 'email', 'staff_created', 'system',
    ];

    protected $fillable = [
        'ticket_number', 'user_id', 'customer_email', 'customer_name',
        'subject', 'description', 'context', 'category_id',
        'subcategory', 'priority', 'status', 'channel', 'assigned_agent_id',
        'assigned_team_id', 'sla_policy_id', 'related_order_id',
        'related_transaction_id', 'related_kyc_reference', 'related_community_id',
        'related_conference_id', 'created_by', 'first_response_at',
        'resolved_at', 'closed_at', 'rating', 'rating_comment', 'rated_at',
    ];

    protected $casts = [
        'first_response_at' => 'datetime',
        'resolved_at' => 'datetime',
        'closed_at' => 'datetime',
        'sla_paused_at' => 'datetime',
        'rated_at' => 'datetime',
        'rating' => 'integer',
        'context' => 'array',
    ];

    public function scopeForEmail(Builder $query, string $email): Builder
    {
        return $query->where('customer_email', $email);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(TicketCategory::class, 'category_id');
    }

    public function slaPolicy(): BelongsTo
    {
        return $this->belongsTo(SlaPolicy::class, 'sla_policy_id');
    }

    public function assignedAgent(): BelongsTo
    {
        return $this->belongsTo(StaffUser::class, 'assigned_agent_id');
    }

    public function assignedTeam(): BelongsTo
    {
        return $this->belongsTo(SupportTeam::class, 'assigned_team_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(StaffUser::class, 'created_by');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(TicketMessage::class)->orderBy('created_at')->orderBy('id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(TicketEvent::class)->orderBy('created_at')->orderBy('id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TicketAttachment::class);
    }

    public function tags(): HasMany
    {
        return $this->hasMany(TicketTag::class)->orderBy('name');
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereNotIn('status', ['resolved', 'closed']);
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    public function scopePriority(Builder $query, string $priority): Builder
    {
        return $query->where('priority', $priority);
    }

    public function scopeAssignedTo(Builder $query, ?int $agentId): Builder
    {
        return $query->when($agentId, fn (Builder $q) => $q->where('assigned_agent_id', $agentId));
    }

    public function scopeTeam(Builder $query, ?int $teamId): Builder
    {
        return $query->when($teamId, fn (Builder $q) => $q->where('assigned_team_id', $teamId));
    }

    public function scopeChannel(Builder $query, ?string $channel): Builder
    {
        return $query->when($channel, fn (Builder $q) => $q->where('channel', $channel));
    }

    public function scopeSearch(Builder $query, ?string $term): Builder
    {
        return $query->when($term, function (Builder $q) use ($term) {
            $q->where(fn (Builder $inner) => $inner
                ->where('ticket_number', 'like', "%{$term}%")
                ->orWhere('subject', 'like', "%{$term}%")
                ->orWhere('description', 'like', "%{$term}%")
                ->orWhereHas('user', fn (Builder $u) => $u->where('email', 'like', "%{$term}%")));
        });
    }

    public function priorityLabel(): string
    {
        return ucfirst($this->priority);
    }

    public function statusLabel(): string
    {
        return Str::title(str_replace('_', ' ', $this->status));
    }

    public function isOpen(): bool
    {
        return ! in_array($this->status, ['resolved', 'closed'], true);
    }

    /**
     * Build a sequential ticket number: MS-2026-000123.
     */
    public static function generateTicketNumber(): string
    {
        $year = now()->format('Y');

        $sequence = \Illuminate\Support\Facades\DB::transaction(function () use ($year) {
            $key = "ticket_sequence_{$year}";
            
            $setting = \Illuminate\Support\Facades\DB::table('support_settings')
                ->where('key', $key)
                ->lockForUpdate()
                ->first();

            if (! $setting) {
                $maxSequence = (int) static::query()
                    ->where('ticket_number', 'like', "MS-{$year}-%")
                    ->count();

                $sequence = $maxSequence + 1;

                \Illuminate\Support\Facades\DB::table('support_settings')->insert([
                    'key' => $key,
                    'value' => (string) $sequence,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                return $sequence;
            }

            $sequence = ((int) $setting->value) + 1;

            \Illuminate\Support\Facades\DB::table('support_settings')
                ->where('key', $key)
                ->update([
                    'value' => (string) $sequence,
                    'updated_at' => now(),
                ]);

            return $sequence;
        });

        return sprintf('MS-%s-%06d', $year, $sequence);
    }
}
