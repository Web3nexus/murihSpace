<?php

namespace Database\Seeders;

use App\Models\SlaPolicy;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class SlaPolicySeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed sensible default SLA policies per ticket priority (idempotent).
     */
    public function run(): void
    {
        $policies = [
            [
                'name' => 'Critical — respond & resolve fast',
                'priority' => 'critical',
                'description' => 'Critical incidents get an agent immediately and a fix within 2 hours.',
                'first_response_target' => 10,
                'next_response_target' => 30,
                'resolution_target' => 120,
                'pause_on_customer' => true,
            ],
            [
                'name' => 'Urgent',
                'priority' => 'urgent',
                'description' => 'Urgent requests: first reply within 30 minutes, resolved within 4 hours.',
                'first_response_target' => 30,
                'next_response_target' => 60,
                'resolution_target' => 240,
            ],
            [
                'name' => 'High',
                'priority' => 'high',
                'description' => 'High priority: first reply within 1 hour, resolved same business day.',
                'first_response_target' => 60,
                'next_response_target' => 120,
                'resolution_target' => 480,
            ],
            [
                'name' => 'Normal',
                'priority' => 'normal',
                'description' => 'Standard requests within one business day.',
                'first_response_target' => 240,
                'next_response_target' => 480,
                'resolution_target' => 1440,
            ],
            [
                'name' => 'Low',
                'priority' => 'low',
                'description' => 'Low priority handled within two business days.',
                'first_response_target' => 1440,
                'next_response_target' => 2880,
                'resolution_target' => 2880,
            ],
        ];

        foreach ($policies as $policy) {
            SlaPolicy::firstOrCreate(
                ['priority' => $policy['priority']],
                array_merge($policy, ['enabled' => true, 'business_hours' => false, 'weekends' => true, 'holidays' => false]),
            );
        }
    }
}
