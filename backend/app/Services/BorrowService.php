<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\Book;
use App\Models\BorrowRequest;
use App\Models\Loan;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class BorrowService
{
    public function createRequest(User $user, int $bookId): BorrowRequest
    {
        if (! $user->is_approved) {
            throw new \Illuminate\Auth\Access\AuthorizationException('Your membership is not yet approved.');
        }

        $book = Book::findOrFail($bookId);

        if ($book->available <= 0) {
            throw new ConflictException('No copies of this book are currently available.');
        }

        $existing = BorrowRequest::where('user_id', $user->uid)
            ->where('book_id', $bookId)
            ->where('status', 'Pending')
            ->exists();

        if ($existing) {
            throw new ConflictException('You already have a pending request for this book.');
        }

        return BorrowRequest::create([
            'user_id'       => $user->uid,
            'user_name'     => $user->full_name,
            'book_id'       => $book->id,
            'book_title'    => $book->title,
            'book_category' => $book->category,
            'status'        => 'Pending',
        ]);
    }

    public function approve(BorrowRequest $borrowRequest, string $librarianUid): Loan
    {
        return DB::transaction(function () use ($borrowRequest, $librarianUid) {
            $book = Book::lockForUpdate()->findOrFail($borrowRequest->book_id);

            if ($book->available <= 0) {
                throw new ConflictException('No copies are available to approve this request.');
            }

            $now  = now();
            $loan = Loan::create([
                'user_id'       => $borrowRequest->user_id,
                'user_name'     => $borrowRequest->user_name,
                'book_id'       => $book->id,
                'book_title'    => $book->title,
                'book_category' => $book->category,
                'status'        => 'Borrowed',
                'borrowed_at'   => $now,
                'due_at'        => $now->copy()->addDays(14),
                'issued_by'     => $librarianUid,
            ]);

            $book->decrement('available');

            $borrowRequest->update([
                'status'       => 'Approved',
                'loan_id'      => $loan->id,
                'processed_at' => $now,
                'processed_by' => $librarianUid,
            ]);

            return $loan;
        });
    }

    public function decline(BorrowRequest $borrowRequest, string $librarianUid): void
    {
        $borrowRequest->update([
            'status'       => 'Declined',
            'processed_at' => now(),
            'processed_by' => $librarianUid,
        ]);
    }
}
