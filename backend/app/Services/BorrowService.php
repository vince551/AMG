<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\Book;
use App\Models\BorrowRequest;
use App\Models\Loan;
use App\Models\User;

class BorrowService
{
    public function createRequest(User $user, int $bookId): BorrowRequest
    {
        return LibraryTransaction::run(function () use ($user, $bookId) {
            $user->refresh();
            app(CirculationService::class)->assertEligible($user);
            $book = Book::whereNull('archived_at')->findOrFail($bookId);
            app(HoldService::class)->reconcile($book);

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

            if ($user->loans()->where('book_id', $bookId)->where('status', 'Borrowed')->exists()) {
                throw new ConflictException('You already have a loan for this title.');
            }

            return BorrowRequest::create([
                'user_id' => $user->uid,
                'user_name' => $user->full_name,
                'book_id' => $book->id,
                'book_title' => $book->title,
                'book_category' => $book->category,
                'status' => 'Pending',
            ]);
        });
    }

    public function approve(BorrowRequest $borrowRequest, string $librarianUid, ?string $barcode = null): Loan
    {
        return LibraryTransaction::run(function () use ($borrowRequest, $librarianUid, $barcode) {
            $borrowRequest->refresh();
            if ($borrowRequest->status !== 'Pending') {
                throw new ConflictException('This request has already been processed.');
            }
            $book = Book::findOrFail($borrowRequest->book_id);
            app(HoldService::class)->reconcile($book);
            $copies = $book->copies();
            $copy = $barcode ? $copies->where('barcode', $barcode)->first() : $copies->where('status', 'Available')->orderBy('id')->first();
            if (! $copy) {
                throw new ConflictException('Select an available copy belonging to this title.');
            }
            $member = User::where('uid', $borrowRequest->user_id)->firstOrFail();
            $loan = app(CirculationService::class)->issueCopy($member, $copy, $librarianUid);
            $borrowRequest->update(['status' => 'Approved', 'loan_id' => $loan->id, 'processed_at' => now(), 'processed_by' => $librarianUid]);
            ActivityService::record('request.approved', 'request', $borrowRequest->id, [], $librarianUid);

            return $loan;
        });
    }

    public function decline(BorrowRequest $borrowRequest, string $librarianUid, ?string $reason = null): void
    {
        LibraryTransaction::run(function () use ($borrowRequest, $librarianUid, $reason) {
            $borrowRequest->refresh();
            if ($borrowRequest->status !== 'Pending') {
                throw new ConflictException('This request has already been processed.');
            }
            $borrowRequest->update(['status' => 'Declined', 'reason' => $reason, 'processed_at' => now(), 'processed_by' => $librarianUid]);
            ActivityService::record('request.declined', 'request', $borrowRequest->id, [], $librarianUid);
            ActivityService::notify($borrowRequest->user_id, 'Request declined', $reason ?: $borrowRequest->book_title.' could not be issued.', 'requests');
        });
    }

    public function cancel(BorrowRequest $request, User $user): void
    {
        abort_unless($request->user_id === $user->uid, 403);
        LibraryTransaction::run(function () use ($request) {
            $request->refresh();
            if ($request->status !== 'Pending') {
                throw new ConflictException('Only pending requests can be cancelled.');
            }
            $request->update(['status' => 'Cancelled', 'processed_at' => now()]);
        });
    }
}
