<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('media', function (Blueprint $table) {
            if (! Schema::hasColumn('media', 'reference_count')) {
                $table->unsignedInteger('reference_count')->default(0)->after('metadata');
            }
            if (! Schema::hasColumn('media', 'last_referenced_at')) {
                $table->timestamp('last_referenced_at')->nullable()->after('reference_count');
            }
        });

        Schema::table('messages', function (Blueprint $table) {
            if (! Schema::hasColumn('messages', 'media_id')) {
                $table->foreignId('media_id')->nullable()->constrained()->nullOnDelete()->after('attachment_type');
            }
            if (! Schema::hasColumn('messages', 'status')) {
                $table->string('status', 20)->default('sent')->after('type');
            }
            if (! Schema::hasColumn('messages', 'media_status')) {
                $table->string('media_status', 20)->nullable()->after('status');
            }
            if (! Schema::hasColumn('messages', 'edited_at')) {
                $table->timestamp('edited_at')->nullable()->after('client_uuid');
            }
            if (! Schema::hasColumn('messages', 'forwarded_from_message_id')) {
                $table->foreignId('forwarded_from_message_id')->nullable()->constrained('messages')->nullOnDelete()->after('reply_to_id');
            }
        });

        if (! Schema::hasTable('message_user_states')) {
            Schema::create('message_user_states', function (Blueprint $table) {
                $table->id();
                $table->foreignId('message_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->boolean('is_hidden')->default(false);
                $table->boolean('is_reported')->default(false);
                $table->timestamps();
                $table->unique(['message_id', 'user_id']);
            });
        }

        if (! Schema::hasTable('storage_usage')) {
            Schema::create('storage_usage', function (Blueprint $table) {
                $table->id();
                $table->morphs('usable');
                $table->string('media_type', 50)->nullable();
                $table->unsignedBigInteger('bytes')->default(0);
                $table->timestamps();
                $table->unique(['usable_type', 'usable_id', 'media_type']);
            });
        }

        Schema::table('communities', function (Blueprint $table) {
            if (! Schema::hasColumn('communities', 'storage_limit_bytes')) {
                $table->unsignedBigInteger('storage_limit_bytes')->nullable()->after('slug');
            }
            if (! Schema::hasColumn('communities', 'chat_lock')) {
                $table->boolean('chat_lock')->default(false)->after('anonymous_posts_allowed');
            }
        });

        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'storage_limit_bytes')) {
                $table->unsignedBigInteger('storage_limit_bytes')->nullable()->after('email');
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_user_states');
        Schema::dropIfExists('storage_usage');

        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('storage_limit_bytes'));
        Schema::table('communities', fn (Blueprint $t) => $t->dropColumn(['storage_limit_bytes', 'chat_lock']));
        Schema::table('messages', fn (Blueprint $t) => $t->dropColumn(['media_id', 'status', 'media_status', 'edited_at', 'forwarded_from_message_id']));
        Schema::table('media', fn (Blueprint $t) => $t->dropColumn(['reference_count', 'last_referenced_at']));
    }
};
