<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sprint 47 — Performance & Monitoring
 *
 * Adds composite indexes on the most common query patterns in the platform
 * to prevent full-table scans on high-traffic reads.
 *
 * All index adds are wrapped in hasIndex() checks to make the migration
 * fully idempotent (safe to re-run or run on a DB that already has them).
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── posts ─────────────────────────────────────────────────────────────
        Schema::table('posts', function (Blueprint $table) {
            // Community feed query: WHERE community_id = ? AND deleted_at IS NULL ORDER BY created_at DESC
            if (! $this->hasIndex('posts', 'posts_community_id_created_at_index')) {
                $table->index(['community_id', 'created_at'], 'posts_community_id_created_at_index');
            }

            // Author profile query: WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC
            if (! $this->hasIndex('posts', 'posts_user_id_created_at_index')) {
                $table->index(['user_id', 'created_at'], 'posts_user_id_created_at_index');
            }

            // Pinned-first query extension: is_pinned queries filtered with community_id
            if (! $this->hasIndex('posts', 'posts_community_id_is_pinned_index')) {
                $table->index(['community_id', 'is_pinned'], 'posts_community_id_is_pinned_index');
            }
        });

        // ── notifications ──────────────────────────────────────────────────────
        Schema::table('notifications', function (Blueprint $table) {
            // Unread count + list: WHERE notifiable_type = ? AND notifiable_id = ?
            // AND read_at IS NULL ORDER BY created_at DESC
            if (! $this->hasIndex('notifications', 'notifications_notifiable_created_at_index')) {
                $table->index(['notifiable_type', 'notifiable_id', 'created_at'], 'notifications_notifiable_created_at_index');
            }
        });

        // ── community_memberships ──────────────────────────────────────────────
        Schema::table('community_memberships', function (Blueprint $table) {
            // Member list / count: WHERE community_id = ? AND status = 'active'
            if (! $this->hasIndex('community_memberships', 'community_memberships_community_id_status_index')) {
                $table->index(['community_id', 'status'], 'community_memberships_community_id_status_index');
            }

            // User's memberships list: WHERE user_id = ? AND status = 'active'
            if (! $this->hasIndex('community_memberships', 'community_memberships_user_id_status_index')) {
                $table->index(['user_id', 'status'], 'community_memberships_user_id_status_index');
            }
        });

        // ── wallet_transactions ────────────────────────────────────────────────
        if (Schema::hasTable('wallet_transactions')) {
            Schema::table('wallet_transactions', function (Blueprint $table) {
                // Transaction history: WHERE wallet_id = ? ORDER BY created_at DESC
                if (! $this->hasIndex('wallet_transactions', 'wallet_transactions_wallet_id_created_at_index')) {
                    $table->index(['wallet_id', 'created_at'], 'wallet_transactions_wallet_id_created_at_index');
                }
            });
        }

        // ── stories ────────────────────────────────────────────────────────────
        if (Schema::hasTable('stories')) {
            Schema::table('stories', function (Blueprint $table) {
                // Feed query: WHERE user_id = ? AND expires_at > NOW()
                if (! $this->hasIndex('stories', 'stories_user_id_expires_at_index')) {
                    $table->index(['user_id', 'expires_at'], 'stories_user_id_expires_at_index');
                }
            });
        }
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropIndexIfExists('posts_community_id_created_at_index');
            $table->dropIndexIfExists('posts_user_id_created_at_index');
            $table->dropIndexIfExists('posts_community_id_is_pinned_index');
        });

        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndexIfExists('notifications_notifiable_created_at_index');
        });

        Schema::table('community_memberships', function (Blueprint $table) {
            $table->dropIndexIfExists('community_memberships_community_id_status_index');
            $table->dropIndexIfExists('community_memberships_user_id_status_index');
        });

        if (Schema::hasTable('wallet_transactions')) {
            Schema::table('wallet_transactions', function (Blueprint $table) {
                $table->dropIndexIfExists('wallet_transactions_wallet_id_created_at_index');
            });
        }

        if (Schema::hasTable('stories')) {
            Schema::table('stories', function (Blueprint $table) {
                $table->dropIndexIfExists('stories_user_id_expires_at_index');
            });
        }
    }

    /**
     * Check if an index exists on a table (cross-DB compatible helper).
     */
    private function hasIndex(string $table, string $indexName): bool
    {
        $indexes = collect(Schema::getIndexes($table));
        return $indexes->contains(fn ($idx) => $idx['name'] === $indexName);
    }
};
