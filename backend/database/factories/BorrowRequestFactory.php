<?php

namespace Database\Factories;

use App\Models\Book;
use App\Models\BorrowRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class BorrowRequestFactory extends Factory
{
    protected $model = BorrowRequest::class;

    public function definition(): array
    {
        $user = User::factory()->approved()->withLibraryNumber()->create();
        $book = Book::factory()->create();

        return [
            'user_id'       => $user->uid,
            'user_name'     => $user->full_name,
            'book_id'       => $book->id,
            'book_title'    => $book->title,
            'book_category' => $book->category,
            'status'        => 'Pending',
        ];
    }

    public function approved(): static
    {
        return $this->state(['status' => 'Approved', 'processed_at' => now()]);
    }

    public function declined(): static
    {
        return $this->state(['status' => 'Declined', 'processed_at' => now()]);
    }
}
