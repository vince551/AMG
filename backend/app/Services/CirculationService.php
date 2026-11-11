<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\BookCopy;
use App\Models\Hold;
use App\Models\Loan;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class CirculationService
{
    public function issue(string $libraryNumber, string $copyBarcode, string $librarianUid): Loan
    {
        return LibraryTransaction::run(function () use ($libraryNumber, $copyBarcode, $librarianUid) {
            $member = User::where('library_number', $libraryNumber)->firstOrFail();
            $copy = BookCopy::where('barcode', $copyBarcode)->firstOrFail();

            return $this->issueCopy($member, $copy, $librarianUid);
        });
    }

    public function issueCopy(User $member, BookCopy $copy, string $librarianUid): Loan
    {
        return LibraryTransaction::run(function () use ($member, $copy, $librarianUid) {
            $member->refresh();
            $this->assertEligible($member);
            $book = $copy->book()->lockForUpdate()->firstOrFail();
            if ($book->archived_at) {
                throw new ConflictException('This title is archived.');
            }
            if ($book->loans()->where('status', 'Borrowed')->whereNull('book_copy_id')->exists()) {
                throw new ConflictException('Reconcile existing unassigned loans before issuing this title.');
            }
            app(HoldService::class)->reconcile($book);
            $copy->refresh();
            $hold = Hold::where('book_copy_id', $copy->id)->where('status', 'Ready')->first();
            if ($copy->status !== 'Available' && ! ($copy->status === 'Reserved' && $hold?->user_id === $member->uid)) {
                throw new ConflictException('This copy is unavailable or reserved for another member.');
            }
            if ($member->loans()->where('book_id', $book->id)->where('status', 'Borrowed')->exists()) {
                throw new ConflictException('This member already has a loan for this title.');
            }
            $policy = app(SettingsService::class)->get();
            if ($member->loans()->where('status', 'Borrowed')->count() >= $policy['loan_limit']) {
                throw new ConflictException('This member has reached the borrowing limit.');
            }
            $loan = Loan::create([
                'user_id' => $member->uid, 'user_name' => $member->full_name,
                'book_id' => $book->id, 'book_title' => $book->title, 'book_category' => $book->category,
                'book_copy_id' => $copy->id, 'status' => 'Borrowed',
                'borrowed_at' => now(), 'due_at' => now()->addDays($policy['loan_days']), 'issued_by' => $librarianUid,
            ]);
            $copy->update(['status' => 'Borrowed']);
            if ($hold) {
                $hold->update(['status' => 'Fulfilled', 'active_key' => null]);
            }
            app(BookService::class)->synchronize($book);
            ActivityService::record('loan.issued', 'loan', $loan->id, [], $librarianUid);
            ActivityService::notify($member->uid, 'Book issued', $book->title.' is due '.$loan->due_at->toDateString().'.', 'loans');

            return $loan;
        });
    }

    public function assertEligible(User $member): void
    {
        if (! $member->is_active || ! $member->is_approved || $member->membership_status !== 'Approved' || $member->role !== 'learner') {
            throw new AuthorizationException('An active, approved membership is required.');
        }
    }

    public function reconcileLoan(Loan $loan, string $barcode): Loan
    {
        return LibraryTransaction::run(function () use ($loan, $barcode) {
            $loan->refresh();
            $copy = BookCopy::where('barcode', $barcode)->where('book_id', $loan->book_id)->firstOrFail();
            if ($loan->status !== 'Borrowed' || $loan->book_copy_id || $copy->status !== 'Available') {
                throw new ConflictException('Only an active unassigned loan can be linked to an available matching copy.');
            }
            $loan->update(['book_copy_id' => $copy->id]);
            $copy->update(['status' => 'Borrowed']);
            app(BookService::class)->synchronize($copy->book);
            ActivityService::record('loan.reconciled', 'loan', $loan->id);

            return $loan;
        });
    }

    public function returnCopy(string $copyBarcode, string $librarianUid): Loan
    {
        return LibraryTransaction::run(function () use ($copyBarcode, $librarianUid) {
            $copy = BookCopy::where('barcode', $copyBarcode)->lockForUpdate()->first();
            if (! $copy) {
                throw new ModelNotFoundException('Book copy not found.');
            }

            $loan = Loan::where('book_copy_id', $copy->id)
                ->where('status', 'Borrowed')
                ->first();

            if (! $loan) {
                throw new ModelNotFoundException('No active loan found for this copy.');
            }

            app(LoanService::class)->returnLoan($loan, $librarianUid);

            return $loan->fresh();
        });
    }
}
