<?php

namespace Database\Factories;

use App\Models\BookCopy;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class BookCopyFactory extends Factory
{
    protected $model = BookCopy::class;

    public function definition(): array
    {
        return [
            'book_id'     => \App\Models\Book::factory(),
            'copy_number' => 1,
            'barcode'     => 'AMG-COPY-'.strtoupper(Str::random(18)),
            'status'      => 'Available',
        ];
    }

    public function borrowed(): static
    {
        return $this->state(['status' => 'Borrowed']);
    }
}
