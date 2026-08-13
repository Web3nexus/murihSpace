<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupportTeam extends Model
{
    use HasFactory;

    public const DEFAULT_TEAMS = [
        'General Support',
        'Technical Support',
        'Billing',
        'Wallet & Payments',
        'KYC',
        'Creators',
        'Vendors',
        'Store & Orders',
        'Community Safety',
        'Conference Support',
    ];

    protected $fillable = [
        'name', 'description', 'is_active', 'sort_order', 'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(StaffUser::class, 'support_team_member')
            ->withPivot('is_lead')
            ->withTimestamps()
            ->orderBy('support_team_member.is_lead', 'desc')
            ->orderBy('staff_users.name');
    }

    public function tickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'assigned_team_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(StaffUser::class, 'created_by');
    }

    public function openTickets(): HasMany
    {
        return $this->hasMany(Ticket::class, 'assigned_team_id')
            ->whereNotIn('status', ['resolved', 'closed']);
    }
}
