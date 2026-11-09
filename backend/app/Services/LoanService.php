<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\Book;
use App\Models\Loan;
use Illuminate\Support\Facades\DB;

class LoanService
{
    public function returnLoan(Loan $loan, string $librarianUid): void
    {
        if ($loan->status !== 'Borrowed') {
            throw new ConflictException('This loan has already been returned.');
        }

        DB::transaction(function () use ($loan, $librarianUid) {
            $loan->update([
                'status'      => 'Returned',
                'returned_at' => now(),
                'returned_by' => $librarianUid,
            ]);

            Book::where('id', $loan->book_id)->increment('available');
        });
    }
}
