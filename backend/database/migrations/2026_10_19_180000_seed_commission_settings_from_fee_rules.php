<?php

use App\Services\Commission\CommissionService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One-time seed. From now on the fee rules page writes commission_percentage_{type}
 * (CommissionService reads only those settings), so existing commission FeeRule rows
 * must be carried into the settings once.
 *
 * - Only a setting that does not exist yet is written. A rate an admin already saved
 *   through the settings page is never overwritten.
 * - Each value written is audited, so a change to a live rate is visible in the log.
 * - Migrations run once, so this does not run again on later deploys.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('fee_rules') || ! Schema::hasTable('admin_settings')) {
            return;
        }

        $rows = DB::table('fee_rules')
            ->where('fee_type', 'percentage')
            ->whereNotNull('percentage')
            ->orderBy('id')
            ->get(['id', 'code', 'percentage']);

        $seeded = [];

        foreach ($rows as $row) {
            $type = CommissionService::commissionTypeForRuleCode($row->code);
            if ($type === null || isset($seeded[$type])) {
                continue;
            }

            $key = "commission_percentage_{$type}";
            if (DB::table('admin_settings')->where('key', $key)->exists()) {
                continue;
            }

            $pct = max(0.0, min(100.0, (float) $row->percentage));
            $now = now();

            DB::table('admin_settings')->insert([
                'key' => $key,
                'value' => (string) $pct,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            if (Schema::hasTable('audit_logs')) {
                DB::table('audit_logs')->insert([
                    'user_id' => null,
                    'action' => 'commission.updated',
                    'resource_type' => 'fee_rule',
                    'resource_id' => (string) $row->id,
                    'metadata' => json_encode([
                        'source' => 'fee_rule_seed',
                        'rule_code' => $row->code,
                        'commission_type' => $type,
                        'previous_percentage' => null,
                        'new_percentage' => $pct,
                    ]),
                    'ip_address' => null,
                    'user_agent' => 'migration:2026_10_19_180000',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            Cache::forget("platform_commission_pct:{$type}");
            $seeded[$type] = $pct;
        }
    }

    public function down(): void
    {
        // Intentionally empty. The seeded settings are live admin values; removing them
        // would silently change the rates charged.
    }
};
