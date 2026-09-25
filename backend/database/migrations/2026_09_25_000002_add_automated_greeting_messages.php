<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                if (!Schema::hasColumn('users', 'greeting_message_enabled')) {
                    $table->boolean('greeting_message_enabled')->default(false)->after('chat_sounds_enabled');
                }
                if (!Schema::hasColumn('users', 'greeting_message')) {
                    $table->text('greeting_message')->nullable()->after('greeting_message_enabled');
                }
                if (!Schema::hasColumn('users', 'away_message_enabled')) {
                    $table->boolean('away_message_enabled')->default(false)->after('greeting_message');
                }
                if (!Schema::hasColumn('users', 'away_message')) {
                    $table->text('away_message')->nullable()->after('away_message_enabled');
                }
            });
        }

        if (Schema::hasTable('messages')) {
            Schema::table('messages', function (Blueprint $table) {
                if (!Schema::hasColumn('messages', 'is_automated')) {
                    $table->boolean('is_automated')->default(false)->after('status');
                }
            });
        }

        if (Schema::hasTable('storefronts')) {
            Schema::table('storefronts', function (Blueprint $table) {
                if (!Schema::hasColumn('storefronts', 'greeting_message_enabled')) {
                    $table->boolean('greeting_message_enabled')->default(false)->after('return_policy');
                }
                if (!Schema::hasColumn('storefronts', 'greeting_message')) {
                    $table->text('greeting_message')->nullable()->after('greeting_message_enabled');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('storefronts')) {
            Schema::table('storefronts', function (Blueprint $table) {
                $table->dropColumn(['greeting_message_enabled', 'greeting_message']);
            });
        }

        if (Schema::hasTable('messages')) {
            Schema::table('messages', function (Blueprint $table) {
                $table->dropColumn(['is_automated']);
            });
        }

        if (Schema::hasTable('users')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn([
                    'greeting_message_enabled',
                    'greeting_message',
                    'away_message_enabled',
                    'away_message',
                ]);
            });
        }
    }
};
