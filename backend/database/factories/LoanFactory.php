<?php

namespace Database\Factories;

use App\Models\Book;
use App\Models\Loan;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class LoanFactory extends Factory
{
    protected $model = Loan::class;

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
            'book_copy_id'  => null,
            'status'        => 'Borrowed',
            'borrowed_at'   => now(),
            'due_at'        => now()->addDays(14),
            'returned_at'   => null,
        ];
    }

    public function returned(): static
    {
        return $this->state([
            'status'      => 'Returned',
            'returned_at' => now(),
        ]);
    }
}
