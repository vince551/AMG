<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        return [
            'uid'               => Str::uuid(),
            'email'             => fake()->unique()->safeEmail(),
            'password'          => 'password',
            'full_name'         => fake()->name(),
            'gender'            => fake()->randomElement(['Male', 'Female', 'Other', 'Prefer not to say']),
            'school'            => fake()->company().' School',
            'study_level'       => fake()->randomElement(['Grade 1', 'Grade 5', 'Form 2', 'Form 5', 'Year 1']),
            'edu_level'         => fake()->randomElement(['Primary', 'Junior Secondary', 'Senior Secondary', 'High School', 'University']),
            'guardian_name'     => fake()->name(),
            'guardian_relation' => fake()->randomElement(['Mother', 'Father', 'Guardian']),
            'guardian_phone'    => fake()->phoneNumber(),
            'library_number'    => null,
            'role'              => 'learner',
            'is_approved'       => false,
            'membership_status' => 'Pending',
            'photo_url'         => null,
            'starred_book_ids'  => [],
        ];
    }

    public function librarian(): static
    {
        return $this->state([
            'role'              => 'librarian',
            'is_approved'       => true,
            'membership_status' => 'Approved',
        ]);
    }

    public function approved(): static
    {
        return $this->state([
            'is_approved'       => true,
            'membership_status' => 'Approved',
            'approved_at'       => now(),
        ]);
    }

    public function withLibraryNumber(): static
    {
        return $this->state(function () {
            return ['library_number' => 'AMG-'.str_pad((string) random_int(1, 999999), 6, '0', STR_PAD_LEFT)];
        });
    }
}
