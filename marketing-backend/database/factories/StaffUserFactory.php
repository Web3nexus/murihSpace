<?php

namespace Database\Factories;

use App\Models\StaffUser;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<StaffUser>
 */
class StaffUserFactory extends Factory
{
    /**
     * Shared hash for the whole factory run. Each run gets a random password
     * that nothing else knows, so tests must pass an explicit password when
     * they need to log in.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make(Str::random(40)),
            'role' => 'support_agent',
            'is_active' => true,
            'permissions' => null,
            'remember_token' => Str::random(10),
        ];
    }

    public function admin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => 'support_admin',
            'permissions' => null,
        ]);
    }

    public function superAdmin(): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => StaffUser::ROLE_SUPER_ADMIN,
            'permissions' => null,
        ]);
    }

    public function role(string $role): static
    {
        return $this->state(fn (array $attributes) => [
            'role' => $role,
            'permissions' => null,
        ]);
    }

    /**
     * Assign an explicit permission list, overriding role defaults.
     */
    public function withPermissions(array $permissions): static
    {
        return $this->state(fn (array $attributes) => [
            'permissions' => $permissions,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => StaffUser::STATUS_DISABLED,
            'is_active' => false,
        ]);
    }

    public function locked(): static
    {
        return $this->state(fn (array $attributes) => [
            'failed_login_attempts' => config('staff.lockout.max_attempts'),
            'locked_until' => now()->addMinutes(config('staff.lockout.lock_minutes')),
        ]);
    }
}
