<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Payment Providers Table
        Schema::create('payment_providers', function (Blueprint $table) {
            $table->id();
            $table->string('code', 50)->unique(); // airwallex, paystack, flutterwave
            $table->string('name', 100);
            $table->boolean('is_enabled')->default(false)->index();
            $table->string('environment', 20)->default('sandbox'); // sandbox, production
            $table->integer('priority')->default(10);
            $table->string('health_status', 30)->default('healthy'); // healthy, degraded, down, maintenance
            $table->timestamp('last_health_check_at')->nullable();
            $table->timestamp('last_successful_request_at')->nullable();
            $table->timestamp('last_failed_request_at')->nullable();
            $table->json('config')->nullable(); // Non-sensitive settings (timeouts, client IDs)
            $table->timestamps();
        });

        // 2. Provider Capabilities Table
        Schema::create('provider_capabilities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_provider_id')->constrained('payment_providers')->cascadeOnDelete();
            $table->string('capability', 60); // card, bank_transfer, mobile_money, payout, refund, fx, virtual_account
            $table->string('country_code', 5)->default('*'); // ISO 3166-1 alpha-2 or wildcard *
            $table->string('currency', 5)->default('*'); // ISO 4217 or wildcard *
            $table->string('status', 60)->default('CONFIRMED'); // CONFIRMED, NOT AVAILABLE, REQUIRES APPROVAL, UNKNOWN
            $table->bigInteger('min_amount')->nullable(); // in minor units
            $table->bigInteger('max_amount')->nullable(); // in minor units
            $table->json('approval_requirements')->nullable();
            $table->timestamps();

            $table->unique(['payment_provider_id', 'capability', 'country_code', 'currency'], 'provider_cap_unique');
            $table->index(['capability', 'currency', 'country_code']);
        });

        // 3. Provider Routing Rules Table
        Schema::create('provider_routes', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);
            $table->string('transaction_type', 40)->default('payment'); // payment, payout, refund
            $table->string('country_code', 5)->default('*'); // ISO or *
            $table->string('currency', 5)->default('*'); // ISO or *
            $table->string('payment_method', 40)->default('*'); // card, bank_transfer, mobile_money, or *
            $table->foreignId('primary_provider_id')->constrained('payment_providers')->cascadeOnDelete();
            $table->foreignId('fallback_provider_id')->nullable()->constrained('payment_providers')->nullOnDelete();
            $table->integer('priority')->default(100); // Lower is higher priority
            $table->boolean('is_active')->default(true)->index();
            $table->json('conditions')->nullable(); // Extended conditions (e.g. min_amount, max_amount)
            $table->timestamps();

            $table->index(['transaction_type', 'is_active', 'priority']);
        });

        // 4. Normalized Internal Payments Table
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->string('public_reference', 64)->unique();
            $table->uuid('internal_reference')->unique();
            $table->string('provider', 50); // Provider code (airwallex, paystack, etc.)
            $table->string('provider_transaction_id')->nullable()->index();
            $table->string('provider_reference')->nullable()->index();
            $table->foreignId('customer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('business_id')->nullable()->index();
            $table->string('transaction_type', 60); // digital_product, order, subscription, gift, coin_pack, wallet_topup
            $table->string('payment_method', 40); // card, bank_transfer, mobile_money, etc.
            $table->bigInteger('amount'); // Minor units (kobo/cents)
            $table->string('currency', 3);
            $table->bigInteger('fees')->default(0); // Minor units
            $table->bigInteger('net_amount'); // Minor units
            $table->string('status', 30)->default('pending'); // pending, processing, successful, failed, cancelled, refunded, partially_refunded, reversed, expired
            $table->text('failure_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->string('idempotency_key', 128)->unique();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['customer_id', 'status']);
            $table->index(['provider', 'provider_reference']);
        });

        // 5. Payment Attempts Table
        Schema::create('payment_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->string('provider', 50);
            $table->string('provider_reference')->nullable();
            $table->json('request_payload')->nullable(); // Credentials/secrets MUST be stripped
            $table->json('response_payload')->nullable();
            $table->integer('http_status')->nullable();
            $table->integer('duration_ms')->nullable();
            $table->string('status', 30); // initiated, verified, failed
            $table->text('error_message')->nullable();
            $table->timestamps();
        });

        // 6. Payment Webhook Events Table
        Schema::create('payment_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider', 50);
            $table->string('provider_event_id', 128)->nullable();
            $table->string('event_type', 100);
            $table->boolean('signature_verified')->default(false);
            $table->string('payload_hash', 64);
            $table->string('raw_payload_reference')->nullable(); // Optional storage path
            $table->json('payload')->nullable();
            $table->string('processing_status', 30)->default('received'); // received, processing, completed, failed, ignored
            $table->timestamp('processed_at')->nullable();
            $table->integer('attempts')->default(0);
            $table->text('error_message')->nullable();
            $table->timestamps();

            $table->unique(['provider', 'provider_event_id'], 'provider_event_unique');
            $table->index(['provider', 'processing_status']);
            $table->index('payload_hash');
        });

        // 7. Payout Destinations Table
        Schema::create('payout_destinations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('destination_type', 40); // bank_account, mobile_money
            $table->string('currency', 3);
            $table->string('country_code', 5);
            $table->string('bank_name')->nullable();
            $table->string('bank_code')->nullable();
            $table->string('account_number_masked', 30);
            $table->string('account_name');
            $table->json('details_encrypted')->nullable(); // Encrypted bank/routing details
            $table->json('provider_recipient_codes')->nullable(); // provider => recipient_code mapping
            $table->boolean('is_default')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->timestamps();
        });

        // 8. Normalized Payouts Table
        Schema::create('payouts', function (Blueprint $table) {
            $table->id();
            $table->string('public_reference', 64)->unique();
            $table->uuid('internal_reference')->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('business_id')->nullable();
            $table->foreignId('payout_destination_id')->nullable()->constrained('payout_destinations')->nullOnDelete();
            $table->bigInteger('amount'); // Minor units
            $table->string('currency', 3);
            $table->bigInteger('fee_amount')->default(0); // Minor units
            $table->bigInteger('net_amount'); // Minor units
            $table->string('provider', 50);
            $table->string('provider_payout_id')->nullable()->index();
            $table->string('provider_reference')->nullable()->index();
            $table->string('status', 30)->default('pending'); // pending, processing, successful, failed, cancelled, reversed
            $table->text('failure_reason')->nullable();
            $table->string('idempotency_key', 128)->unique();
            $table->timestamp('dispatched_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'status']);
            $table->index(['provider', 'provider_reference']);
        });

        // 9. Refunds Table
        Schema::create('refunds', function (Blueprint $table) {
            $table->id();
            $table->string('public_reference', 64)->unique();
            $table->uuid('internal_reference')->unique();
            $table->foreignId('payment_id')->constrained('payments')->cascadeOnDelete();
            $table->bigInteger('amount'); // Minor units
            $table->string('currency', 3);
            $table->string('reason', 255)->nullable();
            $table->string('provider', 50);
            $table->string('provider_refund_id')->nullable()->index();
            $table->string('status', 30)->default('pending'); // pending, processing, successful, failed
            $table->text('failure_reason')->nullable();
            $table->string('idempotency_key', 128)->unique();
            $table->timestamps();

            $table->index(['payment_id', 'status']);
        });

        // 10. FX Quotes & Transactions Table
        Schema::create('fx_quotes', function (Blueprint $table) {
            $table->id();
            $table->string('quote_reference', 64)->unique();
            $table->string('source_currency', 3);
            $table->string('destination_currency', 3);
            $table->decimal('rate', 18, 8); // Explicit exchange rate
            $table->string('provider', 50);
            $table->bigInteger('source_amount'); // Minor units
            $table->bigInteger('destination_amount'); // Minor units
            $table->bigInteger('fee')->default(0); // Minor units
            $table->bigInteger('markup')->default(0); // Minor units
            $table->timestamp('expires_at');
            $table->timestamp('executed_at')->nullable();
            $table->timestamps();

            $table->index(['source_currency', 'destination_currency', 'expires_at']);
        });

        // 11. Reconciliation Records Table
        Schema::create('reconciliation_records', function (Blueprint $table) {
            $table->id();
            $table->date('reconciliation_date')->index();
            $table->string('provider', 50);
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->string('provider_transaction_id')->nullable()->index();
            $table->bigInteger('internal_amount')->nullable();
            $table->bigInteger('provider_amount')->nullable();
            $table->string('internal_currency', 3)->nullable();
            $table->string('provider_currency', 3)->nullable();
            $table->string('internal_status', 30)->nullable();
            $table->string('provider_status', 30)->nullable();
            $table->string('discrepancy_type', 50)->default('none'); // none, missing_internal, missing_provider, amount_mismatch, status_mismatch
            $table->string('resolution_status', 30)->default('matched'); // matched, unmatched, mismatch, investigation, resolved
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['reconciliation_date', 'provider', 'resolution_status'], 'rec_date_prov_res_idx');
        });

        // 12. Idempotency Keys Table
        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->string('key', 128)->unique();
            $table->string('scope', 60); // payment_create, payout_create, refund_create
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('request_hash', 64);
            $table->integer('response_status')->nullable();
            $table->json('response_body')->nullable();
            $table->timestamp('locked_until')->nullable();
            $table->timestamps();

            $table->index(['key', 'scope']);
        });

        // 13. Provider API Logs (Sanitized & Masked)
        Schema::create('provider_api_logs', function (Blueprint $table) {
            $table->id();
            $table->string('correlation_id', 64)->index();
            $table->string('provider', 50);
            $table->string('endpoint');
            $table->string('http_method', 10);
            $table->integer('http_status')->nullable();
            $table->integer('duration_ms')->nullable();
            $table->boolean('is_success')->default(true);
            $table->string('error_code', 100)->nullable();
            $table->json('sanitized_request')->nullable(); // Card numbers, CVVs, API keys strictly scrubbed
            $table->json('sanitized_response')->nullable();
            $table->timestamps();

            $table->index(['provider', 'created_at']);
        });

        // 14. Financial Audit Logs (Immutable admin actions)
        Schema::create('financial_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 100); // provider_toggle, route_update, manual_sync, refund_issue, etc.
            $table->string('resource_type', 100);
            $table->string('resource_id', 64);
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->text('reason')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['action', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('financial_audit_logs');
        Schema::dropIfExists('provider_api_logs');
        Schema::dropIfExists('idempotency_keys');
        Schema::dropIfExists('reconciliation_records');
        Schema::dropIfExists('fx_quotes');
        Schema::dropIfExists('refunds');
        Schema::dropIfExists('payouts');
        Schema::dropIfExists('payout_destinations');
        Schema::dropIfExists('payment_webhook_events');
        Schema::dropIfExists('payment_attempts');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('provider_routes');
        Schema::dropIfExists('provider_capabilities');
        Schema::dropIfExists('payment_providers');
    }
};

