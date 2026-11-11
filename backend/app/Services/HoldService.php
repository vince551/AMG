<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\Book;
use App\Models\BookCopy;
use App\Models\Hold;
use App\Models\Loan;
use App\Models\User;

class HoldService
{
    public function create(User $user, int $bookId): Hold
    {
        return LibraryTransaction::run(function () use ($user, $bookId) {
            $user->refresh();
            app(CirculationService::class)->assertEligible($user);
            $book = Book::whereNull('archived_at')->findOrFail($bookId);
            $this->reconcile($book);
            if ($book->available > 0) {
                throw new ConflictException('A copy is available. Submit a borrow request instead.');
            }
            if (Hold::where('active_key', $user->uid.':'.$bookId)->exists()) {
                throw new ConflictException('You already have an active hold for this title.');
            }
            if ($user->loans()->where('book_id', $bookId)->where('status', 'Borrowed')->exists() || $user->borrowRequests()->where('book_id', $bookId)->where('status', 'Pending')->exists()) {
                throw new ConflictException('You already have a loan or pending request for this title.');
            }
            $hold = Hold::create(['user_id' => $user->uid, 'book_id' => $bookId, 'status' => 'Waiting', 'active_key' => $user->uid.':'.$bookId]);
            ActivityService::notify($user->uid, 'Hold placed', 'You are in the pickup queue for '.$book->title.'.', 'requests');

            return $hold;
        });
    }

    public function cancel(Hold $hold, User $actor): void
    {
        abort_unless($actor->isStaff() || $hold->user_id === $actor->uid, 403);
        LibraryTransaction::run(function () use ($hold) {
            $hold->refresh();
            if (! in_array($hold->status, ['Waiting', 'Ready'], true)) {
                throw new ConflictException('This hold is no longer active.');
            }
            $this->release($hold, 'Cancelled');
            $this->reconcile($hold->book);
            ActivityService::record('hold.cancelled', 'hold', $hold->id);
        });
    }

    public function reconcile(Book $book): void
    {
        LibraryTransaction::run(function () use ($book) {
            $book->refresh();
            foreach (Hold::with('member')->where('book_id', $book->id)->whereIn('status', ['Waiting', 'Ready'])->orderBy('created_at')->orderBy('id')->get() as $hold) {
                $member = $hold->member;
                if (! $member || ! $member->is_active || ! $member->is_approved || $member->role !== 'learner' || $book->archived_at) {
                    $this->release($hold, 'Cancelled');
                } elseif ($hold->status === 'Ready' && $hold->expires_at?->lte(now())) {
                    $this->release($hold, 'Expired');
                }
            }
            $legacy = $book->loans()->where('status', 'Borrowed')->whereNull('book_copy_id')->exists();
            if (! $legacy && ! $book->archived_at) {
                foreach (Hold::where('book_id', $book->id)->where('status', 'Waiting')->orderBy('created_at')->orderBy('id')->get() as $hold) {
                    $copy = $book->copies()->where('status', 'Available')->orderBy('id')->first();
                    if (! $copy) {
                        break;
                    }
                    $copy->update(['status' => 'Reserved']);
                    $hold->update(['status' => 'Ready', 'book_copy_id' => $copy->id, 'expires_at' => now()->addHours(app(SettingsService::class)->get()['hold_hours'])]);
                    ActivityService::notify($hold->user_id, 'Your hold is ready', $book->title.' is ready for pickup until '.$hold->expires_at->format('M j, Y H:i').' UTC.', 'requests', 'hold-ready:'.$hold->id);
                    ActivityService::record('hold.ready', 'hold', $hold->id);
                }
            }
            app(BookService::class)->synchronize($book);
        });
    }

    private function release(Hold $hold, string $status): void
    {
        if ($hold->book_copy_id) {
            BookCopy::whereKey($hold->book_copy_id)->where('status', 'Reserved')->update(['status' => 'Available']);
        }
        $hold->update(['status' => $status, 'active_key' => null]);
        ActivityService::notify($hold->user_id, 'Hold '.strtolower($status), 'Your hold for '.$hold->book->title.' was '.strtolower($status).'.', 'requests', 'hold-closed:'.$hold->id);
    }

    public function maintain(): void
    {
        Book::whereIn('id', Hold::whereIn('status', ['Waiting', 'Ready'])->select('book_id'))->chunkById(100, function ($books) {
            foreach ($books as $book) {
                $this->reconcile($book);
            }
        });
        Loan::where('status', 'Borrowed')->where('due_at', '<=', now()->addDays(2))->chunkById(100, function ($loans) {
            foreach ($loans as $loan) {
                $overdue = $loan->due_at->isPast();
                ActivityService::notify($loan->user_id, $overdue ? 'Book overdue' : 'Book due soon', $loan->book_title.' is due '.$loan->due_at->toDateString().'.', 'loans', ($overdue ? 'overdue:'.now()->toDateString() : 'due:'.$loan->due_at->toDateString()).':'.$loan->id);
            }
        });
    }
}
