<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\BookCopy;
use App\Models\Loan;
use App\Models\RenewalRequest;

class LoanService
{
    public function returnLoan(Loan $loan, string $librarianUid): void
    {
        LibraryTransaction::run(function () use ($loan, $librarianUid) {
            $loan->refresh();
            if ($loan->status !== 'Borrowed') {
                throw new ConflictException('This loan has already been returned.');
            }
            $loan->update([
                'status' => 'Returned',
                'returned_at' => now(),
                'returned_by' => $librarianUid,
            ]);

            if ($loan->book_copy_id) {
                BookCopy::whereKey($loan->book_copy_id)->update(['status' => 'Available']);
            }
            RenewalRequest::where('loan_id', $loan->id)->where('status', 'Pending')->update(['status' => 'Declined', 'active_loan_id' => null, 'reason' => 'The loan was returned.', 'processed_at' => now(), 'processed_by' => $librarianUid]);
            app(BookService::class)->synchronize($loan->book);
            app(HoldService::class)->reconcile($loan->book);
            ActivityService::record('loan.returned', 'loan', $loan->id, [], $librarianUid);
            ActivityService::notify($loan->user_id, 'Book returned', $loan->book_title.' has been returned.', 'loans');
        });
    }
}
