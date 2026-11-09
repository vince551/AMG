<?php

namespace Database\Factories;

use App\Models\Ebook;
use Illuminate\Database\Eloquent\Factories\Factory;

class EbookFactory extends Factory
{
    protected $model = Ebook::class;

    public function definition(): array
    {
        $ext = fake()->randomElement(['pdf', 'epub']);

        return [
            'title'        => fake()->sentence(3),
            'category'     => fake()->randomElement(['Primary', 'High School', 'University', 'General / Fiction']),
            'file_name'    => fake()->slug(3).'.'.$ext,
            'storage_path' => 'ebooks/'.fake()->uuid().'.'.$ext,
            'size'         => fake()->numberBetween(100_000, 10_000_000),
            'uploaded_by'  => fake()->uuid(),
        ];
    }
}
