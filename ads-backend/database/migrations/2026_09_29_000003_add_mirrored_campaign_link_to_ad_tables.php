<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Mirrored advertisers' campaigns created in the main MurihSpace app carry
 * their main-app campaign id so the cross-DB sync is idempotent. Campaigns
 * also gain a denormalised advertiser_id (delivery + wallet lookups need it;
 * campaigns previously only had ad_account_id).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->unsignedBigInteger('external_campaign_id')->nullable()->index()->after('id');
            $table->foreignId('advertiser_id')->nullable()->after('ad_account_id')
                ->constrained('advertisers')->nullOnDelete()->index();
        });

        Schema::table('ad_groups', function (Blueprint $table) {
            $table->unsignedBigInteger('external_campaign_id')->nullable()->index()->after('id');
        });

        Schema::table('ads', function (Blueprint $table) {
            $table->unsignedBigInteger('external_campaign_id')->nullable()->index()->after('id');
        });

        Schema::table('creatives', function (Blueprint $table) {
            $table->unsignedBigInteger('external_campaign_id')->nullable()->index()->after('id');
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table) {
            $table->dropForeign(['advertiser_id']);
            $table->dropColumn(['external_campaign_id', 'advertiser_id']);
        });

        Schema::table('ad_groups', function (Blueprint $table) {
            $table->dropColumn('external_campaign_id');
        });

        Schema::table('ads', function (Blueprint $table) {
            $table->dropColumn('external_campaign_id');
        });

        Schema::table('creatives', function (Blueprint $table) {
            $table->dropColumn('external_campaign_id');
        });
    }
};