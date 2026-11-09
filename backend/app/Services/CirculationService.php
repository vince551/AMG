<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\BookCopy;
use App\Models\Loan;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class CirculationService
{
    public function issue(string $libraryNumber, string $copyBarcode, string $librarianUid): Loan
    {
        return DB::transaction(function () use ($libraryNumber, $copyBarcode, $librarianUid) {
            $member = User::where('library_number', $libraryNumber)->first();
            if (! $member) {
                throw new \Illuminate\Database\Eloquent\ModelNotFoundException('Member not found.');
            }

            if (! $member->is_approved) {
                throw new \Illuminate\Auth\Access\AuthorizationException('Member is not approved.');
            }

            $copy = BookCopy::where('barcode', $copyBarcode)->lockForUpdate()->first();
            if (! $copy) {
                throw new \Illuminate\Database\Eloquent\ModelNotFoundException('Book copy not found.');
            }

            if ($copy->status !== 'Available') {
                throw new ConflictException('This copy is not available for issue.');
            }

            $now  = now();
            $loan = Loan::create([
                'user_id'       => $member->uid,
                'user_name'     => $member->full_name,
                'book_id'       => $copy->book_id,
                'book_title'    => $copy->book->title,
                'book_category' => $copy->book->category,
                'book_copy_id'  => $copy->id,
                'status'        => 'Borrowed',
                'borrowed_at'   => $now,
                'due_at'        => $now->copy()->addDays(14),
                'issued_by'     => $librarianUid,
            ]);

            $copy->update(['status' => 'Borrowed']);
            $copy->book()->decrement('available');

            return $loan;
        });
    }

    public function returnCopy(string $copyBarcode, string $librarianUid): Loan
    {
        return DB::transaction(function () use ($copyBarcode, $librarianUid) {
            $copy = BookCopy::where('barcode', $copyBarcode)->lockForUpdate()->first();
            if (! $copy) {
                throw new \Illuminate\Database\Eloquent\ModelNotFoundException('Book copy not found.');
            }

            $loan = Loan::where('book_copy_id', $copy->id)
                ->where('status', 'Borrowed')
                ->first();

            if (! $loan) {
                throw new \Illuminate\Database\Eloquent\ModelNotFoundException('No active loan found for this copy.');
            }

            $loan->update([
                'status'      => 'Returned',
                'returned_at' => now(),
                'returned_by' => $librarianUid,
            ]);

            $copy->update(['status' => 'Available']);
            $copy->book()->increment('available');

            return $loan->fresh();
        });
    }
}
