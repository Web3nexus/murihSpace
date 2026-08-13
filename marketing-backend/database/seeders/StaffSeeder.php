<?php

namespace Database\Seeders;

use App\Models\StaffUser;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class StaffSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed default SecureCRM accounts.
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }
        StaffUser::firstOrCreate(
            ['email' => 'admin@murihspace.com'],
            [
                'name' => 'SecureCRM Admin',
                'password' => Hash::make('password'),
                'role' => 'support_admin',
                'is_active' => true,
                'permissions' => null,
            ]
        );

        $demoStaff = [
            'agent@murihspace.com' => ['SecureCRM Agent', 'support_agent'],
            'manager@murihspace.com' => ['SecureCRM Manager', 'support_manager'],
            'content@murihspace.com' => ['Help Center Editor', 'content_manager'],
        ];

        foreach ($demoStaff as $email => [$name, $role]) {
            StaffUser::firstOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => Hash::make('password'),
                    'role' => $role,
                    'is_active' => true,
                    'permissions' => null,
                ]
            );
        }
    }
}
