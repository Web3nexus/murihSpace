<?php

namespace Database\Seeders;

use App\Enums\CapabilityStatus;
use App\Enums\ProviderHealthStatus;
use App\Models\PaymentProvider;
use App\Models\ProviderCapability;
use App\Models\ProviderRoute;
use Illuminate\Database\Seeder;

class PaymentInfrastructureSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Seed Payment Providers
        $airwallex = PaymentProvider::updateOrCreate(
            ['code' => 'airwallex'],
            [
                'name' => 'Airwallex Global Payments',
                'is_enabled' => (bool) config('payments.providers.airwallex.enabled', true),
                'environment' => config('payments.providers.airwallex.environment', 'sandbox'),
                'priority' => 10,
                'health_status' => ProviderHealthStatus::Healthy,
            ]
        );

        $paystack = PaymentProvider::updateOrCreate(
            ['code' => 'paystack'],
            [
                'name' => 'Paystack Payments',
                'is_enabled' => (bool) config('payments.providers.paystack.enabled', true),
                'environment' => config('payments.providers.paystack.environment', 'test'),
                'priority' => 20,
                'health_status' => ProviderHealthStatus::Healthy,
            ]
        );

        $flutterwave = PaymentProvider::updateOrCreate(
            ['code' => 'flutterwave'],
            [
                'name' => 'Flutterwave for Business',
                'is_enabled' => (bool) config('payments.providers.flutterwave.enabled', true),
                'environment' => config('payments.providers.flutterwave.environment', 'sandbox'),
                'priority' => 30,
                'health_status' => ProviderHealthStatus::Healthy,
            ]
        );

        // 2. Seed Capabilities with Official Verification Statuses
        $capabilities = [
            // Paystack Capabilities
            ['provider_id' => $paystack->id, 'capability' => 'card', 'country' => 'NG', 'currency' => 'NGN', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $paystack->id, 'capability' => 'bank_transfer', 'country' => 'NG', 'currency' => 'NGN', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $paystack->id, 'capability' => 'card', 'country' => 'GH', 'currency' => 'GHS', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $paystack->id, 'capability' => 'mobile_money', 'country' => 'GH', 'currency' => 'GHS', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $paystack->id, 'capability' => 'card', 'country' => 'ZA', 'currency' => 'ZAR', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $paystack->id, 'capability' => 'payout', 'country' => 'NG', 'currency' => 'NGN', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $paystack->id, 'capability' => 'refund', 'country' => '*', 'currency' => '*', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $paystack->id, 'capability' => 'mobile_money', 'country' => 'NG', 'currency' => 'NGN', 'status' => CapabilityStatus::NotAvailable],

            // Flutterwave Capabilities
            ['provider_id' => $flutterwave->id, 'capability' => 'card', 'country' => 'NG', 'currency' => 'NGN', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $flutterwave->id, 'capability' => 'bank_transfer', 'country' => 'NG', 'currency' => 'NGN', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $flutterwave->id, 'capability' => 'mobile_money', 'country' => 'KE', 'currency' => 'KES', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $flutterwave->id, 'capability' => 'mobile_money', 'country' => 'GH', 'currency' => 'GHS', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $flutterwave->id, 'capability' => 'mobile_money', 'country' => 'UG', 'currency' => 'UGX', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $flutterwave->id, 'capability' => 'payout', 'country' => 'NG', 'currency' => 'NGN', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $flutterwave->id, 'capability' => 'refund', 'country' => '*', 'currency' => '*', 'status' => CapabilityStatus::Confirmed],

            // Airwallex Capabilities
            ['provider_id' => $airwallex->id, 'capability' => 'card', 'country' => 'US', 'currency' => 'USD', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'card', 'country' => 'GB', 'currency' => 'GBP', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'card', 'country' => 'DE', 'currency' => 'EUR', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'card', 'country' => '*', 'currency' => 'USD', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'card', 'country' => '*', 'currency' => 'EUR', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'card', 'country' => '*', 'currency' => 'GBP', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'bank_transfer', 'country' => 'US', 'currency' => 'USD', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'payout', 'country' => '*', 'currency' => 'USD', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'payout', 'country' => '*', 'currency' => 'EUR', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'payout', 'country' => '*', 'currency' => 'GBP', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'refund', 'country' => '*', 'currency' => '*', 'status' => CapabilityStatus::Confirmed],
            ['provider_id' => $airwallex->id, 'capability' => 'mobile_money', 'country' => '*', 'currency' => '*', 'status' => CapabilityStatus::NotAvailable],
        ];

        foreach ($capabilities as $cap) {
            ProviderCapability::updateOrCreate(
                [
                    'payment_provider_id' => $cap['provider_id'],
                    'capability' => $cap['capability'],
                    'country_code' => $cap['country'],
                    'currency' => $cap['currency'],
                ],
                [
                    'status' => $cap['status'],
                ]
            );
        }

        // 3. Seed Database Provider Routing Rules
        $routes = [
            [
                'name' => 'Nigeria NGN Cards & Bank Transfers',
                'transaction_type' => 'payment',
                'country_code' => 'NG',
                'currency' => 'NGN',
                'payment_method' => '*',
                'primary_provider_id' => $paystack->id,
                'fallback_provider_id' => $flutterwave->id,
                'priority' => 10,
                'is_active' => true,
            ],
            [
                'name' => 'East Africa Mobile Money (KES)',
                'transaction_type' => 'payment',
                'country_code' => 'KE',
                'currency' => 'KES',
                'payment_method' => 'mobile_money',
                'primary_provider_id' => $flutterwave->id,
                'fallback_provider_id' => null,
                'priority' => 15,
                'is_active' => true,
            ],
            [
                'name' => 'International USD Payments',
                'transaction_type' => 'payment',
                'country_code' => '*',
                'currency' => 'USD',
                'payment_method' => 'card',
                'primary_provider_id' => $airwallex->id,
                'fallback_provider_id' => $flutterwave->id,
                'priority' => 20,
                'is_active' => true,
            ],
            [
                'name' => 'International EUR Payments',
                'transaction_type' => 'payment',
                'country_code' => '*',
                'currency' => 'EUR',
                'payment_method' => 'card',
                'primary_provider_id' => $airwallex->id,
                'fallback_provider_id' => $flutterwave->id,
                'priority' => 25,
                'is_active' => true,
            ],
            [
                'name' => 'International GBP Payments',
                'transaction_type' => 'payment',
                'country_code' => '*',
                'currency' => 'GBP',
                'payment_method' => 'card',
                'primary_provider_id' => $airwallex->id,
                'fallback_provider_id' => $flutterwave->id,
                'priority' => 30,
                'is_active' => true,
            ],
            [
                'name' => 'Nigeria NGN Creator Payouts',
                'transaction_type' => 'payout',
                'country_code' => 'NG',
                'currency' => 'NGN',
                'payment_method' => '*',
                'primary_provider_id' => $flutterwave->id,
                'fallback_provider_id' => $paystack->id,
                'priority' => 10,
                'is_active' => true,
            ],
            [
                'name' => 'Global USD/EUR Payouts',
                'transaction_type' => 'payout',
                'country_code' => '*',
                'currency' => 'USD',
                'payment_method' => '*',
                'primary_provider_id' => $airwallex->id,
                'fallback_provider_id' => null,
                'priority' => 20,
                'is_active' => true,
            ],
        ];

        foreach ($routes as $route) {
            ProviderRoute::updateOrCreate(
                [
                    'name' => $route['name'],
                    'transaction_type' => $route['transaction_type'],
                ],
                $route
            );
        }
    }
}

