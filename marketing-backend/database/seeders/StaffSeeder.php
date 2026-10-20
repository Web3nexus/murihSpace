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
     * Creates one bootstrap super admin for local development, and only when
     * STAFF_BOOTSTRAP_EMAIL and STAFF_BOOTSTRAP_PASSWORD are set in the
     * environment. No account or password is hardcoded here.
     */
    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            return;
        }

        $email = config('staff.bootstrap.email');
        $password = config('staff.bootstrap.password');

        if (! $email || ! $password) {
            return;
        }

        StaffUser::firstOrCreate(
            ['email' => $email],
            [
                'name' => config('staff.bootstrap.name'),
                'password' => Hash::make($password),
                'role' => StaffUser::ROLE_SUPER_ADMIN,
                'status' => StaffUser::STATUS_ACTIVE,
                'permissions' => null,
            ]
        );
    }
}
