<?php

namespace Database\Factories;

use App\Models\Book;
use Illuminate\Database\Eloquent\Factories\Factory;

class BookFactory extends Factory
{
    protected $model = Book::class;

    public function definition(): array
    {
        $qty = fake()->numberBetween(1, 20);

        return [
            'title'       => fake()->unique()->sentence(3),
            'author'      => fake()->name(),
            'category'    => fake()->randomElement([
                'PP / Pre-Primary', 'Primary', 'Junior Secondary',
                'Senior Secondary', 'High School', 'University',
                'General / Fiction', 'Other',
            ]),
            'quantity'    => $qty,
            'available'   => $qty,
            'cover_url'   => null,
            'description' => fake()->paragraph(),
        ];
    }
}
