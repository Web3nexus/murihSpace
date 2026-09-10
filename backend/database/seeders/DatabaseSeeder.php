<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new \RuntimeException('Demo users may only be seeded locally or in tests.');
        }

        $seedPassword = env('SEED_USER_PASSWORD', 'password');

        $users = [
            [
                'name' => 'Admin User',
                'email' => 'admin@murihspace.com',
                'username' => 'admin',
                'password' => bcrypt($seedPassword),
                'role' => 'admin',
                'kyc_status' => 'verified',
            ],
            [
                'name' => 'Creator User',
                'email' => 'creator@murihspace.com',
                'username' => 'creator',
                'password' => bcrypt($seedPassword),
                'role' => 'creator',
                'kyc_status' => 'verified',
            ],
            [
                'name' => 'Vendor User',
                'email' => 'vendor@murihspace.com',
                'username' => 'vendor',
                'password' => bcrypt($seedPassword),
                'role' => 'vendor',
                'kyc_status' => 'verified',
            ],
            [
                'name' => 'Member User',
                'email' => 'member@murihspace.com',
                'username' => 'member',
                'password' => bcrypt($seedPassword),
                'role' => 'member',
                'kyc_status' => 'verified',
            ],
        ];

        foreach ($users as $user) {
            User::factory()->create($user);
        }

        $this->call(GiftsAndCoinPacksSeeder::class);
        $this->call(FeatureFlagSeeder::class);
    }
}
