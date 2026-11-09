<?php

namespace Database\Factories;

use App\Models\Post;
use Illuminate\Database\Eloquent\Factories\Factory;

class PostFactory extends Factory
{
    protected $model = Post::class;

    public function definition(): array
    {
        return [
            'type'       => fake()->randomElement(['announcement', 'event']),
            'title'      => fake()->sentence(5),
            'body'       => fake()->paragraphs(2, true),
            'date'       => fake()->optional(0.6)->dateTimeBetween('now', '+3 months'),
            'created_by' => fake()->uuid(),
        ];
    }

    public function announcement(): static
    {
        return $this->state(['type' => 'announcement']);
    }

    public function event(): static
    {
        return $this->state(['type' => 'event', 'date' => fake()->dateTimeBetween('now', '+3 months')]);
    }
}
