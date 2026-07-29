<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $t) {
            if (!$this->hasIndex('users', 'users_status_index')) $t->index('status');
            if (!$this->hasIndex('users', 'users_role_index')) $t->index('role');
            if (!$this->hasIndex('users', 'users_kyc_status_index')) $t->index('kyc_status');
        });

        Schema::table('communities', function (Blueprint $t) {
            if (!$this->hasIndex('communities', 'communities_visibility_index')) $t->index('visibility');
        });

        Schema::table('posts', function (Blueprint $t) {
            if (!$this->hasIndex('posts', 'posts_community_id_is_draft_index')) $t->index(['community_id', 'is_draft']);
            if (!$this->hasIndex('posts', 'posts_user_id_index')) $t->index('user_id');
        });

        Schema::table('digital_products', function (Blueprint $t) {
            if (!$this->hasIndex('digital_products', 'digital_products_status_index')) $t->index('status');
        });

        Schema::table('email_sequences', function (Blueprint $t) {
            if (!$this->hasIndex('email_sequences', 'email_sequences_trigger_event_index')) $t->index('trigger_event');
        });
    }

    public function down(): void
    {
        $drop = fn(string $table, array $cols) => Schema::table($table, fn(Blueprint $t) => $t->dropIndex($cols));
        if ($this->hasIndex('users', 'users_status_index')) $drop('users', ['status']);
        if ($this->hasIndex('users', 'users_role_index')) $drop('users', ['role']);
        if ($this->hasIndex('users', 'users_kyc_status_index')) $drop('users', ['kyc_status']);
        if ($this->hasIndex('communities', 'communities_visibility_index')) $drop('communities', ['visibility']);
        if ($this->hasIndex('posts', 'posts_community_id_is_draft_index')) $drop('posts', ['community_id', 'is_draft']);
        if ($this->hasIndex('posts', 'posts_user_id_index')) $drop('posts', ['user_id']);
        if ($this->hasIndex('digital_products', 'digital_products_status_index')) $drop('digital_products', ['status']);
        if ($this->hasIndex('email_sequences', 'email_sequences_trigger_event_index')) $drop('email_sequences', ['trigger_event']);
    }

    private function hasIndex(string $table, string $name): bool
    {
        return collect(Schema::getIndexes($table))->contains(fn($i) => $i['name'] === $name);
    }
};
