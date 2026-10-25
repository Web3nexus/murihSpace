<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Legacy template slug => closest current template.
     */
    private const REMAP = [
        'minimal' => 'hero',
        'compact' => 'hero',
        'grid' => 'lookbook',
        'magazine' => 'lookbook',
        'cards' => 'showcase',
        'terminal' => 'showcase',
        'portal' => 'showcase',
        'storefront' => 'boutique',
        'bold' => 'boutique',
        'social' => 'atelier',
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach (self::REMAP as $legacy => $current) {
            DB::table('link_in_bio_designs')
                ->where('template', $legacy)
                ->update(['template' => $current]);
        }

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE link_in_bio_designs ALTER COLUMN template SET DEFAULT 'hero'");
        }
    }

    /**
     * Reverse the migrations.
     *
     * Remapped rows cannot be restored to their exact former slug, so only the column default is reverted.
     */
    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement("ALTER TABLE link_in_bio_designs ALTER COLUMN template SET DEFAULT 'minimal'");
        }
    }
};
