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
        // 1. Tax Rates & Jurisdictions Configuration
        Schema::create('tax_rates', function (Blueprint $table) {
            $table->id();
            $table->string('country_code', 3)->index(); // ISO Alpha-3 (e.g. NGA, USA, GBR)
            $table->string('country_name', 100);
            $table->string('tax_name', 100); // e.g. "Value Added Tax (VAT)", "Sales Tax"
            $table->decimal('standard_rate_percentage', 5, 2)->default(0.00); // e.g. 7.50
            $table->decimal('wht_rate_percentage', 5, 2)->default(0.00); // Withholding Tax rate on payouts e.g. 5.00
            $table->json('stream_rates')->nullable(); // Stream-specific overrides: {"ads": 7.5, "commerce": 7.5, "tips_gifts": 0}
            $table->boolean('is_active')->default(true);
            $table->string('tax_number_format', 50)->nullable(); // Format validation hint
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['country_code', 'tax_name']);
        });

        // 2. Master Revenue Stream Journal (Accounting Ledger per Stream)
        Schema::create('revenue_stream_entries', function (Blueprint $table) {
            $table->id();
            $table->string('reference', 64)->unique(); // Internal accounting entry reference
            $table->enum('stream_type', [
                'ads',
                'commerce',
                'subscriptions',
                'tips_gifts',
                'verification',
                'other',
            ])->index();
            $table->string('source_system', 50)->default('backend'); // 'backend', 'ads-backend', etc.
            $table->string('source_id', 100)->nullable()->index(); // ID in source system (e.g. ad campaign id, order id)
            $table->string('currency', 3)->default('USD')->index();
            $table->unsignedBigInteger('gross_amount_cents'); // Total money received from customer
            $table->unsignedBigInteger('platform_fee_cents')->default(0); // Platform take-rate
            $table->unsignedBigInteger('creator_vendor_amount_cents')->default(0); // Creator/vendor earnings liability
            $table->unsignedBigInteger('gateway_fee_cents')->default(0); // Third-party processor cost
            $table->unsignedBigInteger('tax_amount_cents')->default(0); // VAT/GST/Sales tax collected
            $table->bigInteger('net_platform_revenue_cents')->default(0); // Net recognized revenue for MurihSpace
            $table->string('country_code', 3)->nullable()->index(); // Customer/advertiser tax jurisdiction
            $table->decimal('tax_rate_applied', 5, 2)->nullable();
            $table->string('tax_type', 30)->nullable(); // 'vat', 'sales_tax', 'dst', 'exempt'
            $table->foreignId('tax_rate_id')->nullable()->constrained('tax_rates')->nullOnDelete();
            $table->json('metadata')->nullable(); // Additional breakdown (e.g. advertiser_id, seller_id, campaign_name)
            $table->timestamps();

            $table->index(['stream_type', 'created_at']);
            $table->index(['country_code', 'stream_type']);
        });

        // 3. Tax Liabilities & Remittance Schedules
        Schema::create('tax_liabilities', function (Blueprint $table) {
            $table->id();
            $table->string('period_identifier', 20)->index(); // e.g. "2026-Q3", "2026-09"
            $table->date('period_start');
            $table->date('period_end');
            $table->string('country_code', 3)->index();
            $table->string('currency', 3)->default('USD');
            $table->string('tax_type', 50)->default('VAT'); // 'VAT', 'WHT', 'DST'
            $table->unsignedBigInteger('taxable_base_cents')->default(0);
            $table->unsignedBigInteger('tax_collected_cents')->default(0); // Output VAT collected on inflows
            $table->unsignedBigInteger('wht_withheld_cents')->default(0); // WHT deducted on creator payouts
            $table->enum('status', ['accruing', 'reported', 'remitted'])->default('accruing')->index();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reported_at')->nullable();
            $table->timestamp('remitted_at')->nullable();
            $table->string('filing_reference', 100)->nullable(); // Reference from tax authority (e.g. FIRS receipt)
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['period_identifier', 'country_code', 'currency', 'tax_type'], 'tax_liability_unique_period');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tax_liabilities');
        Schema::dropIfExists('revenue_stream_entries');
        Schema::dropIfExists('tax_rates');
    }
};

