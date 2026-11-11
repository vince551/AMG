<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Book;
use App\Models\BookCopy;
use App\Models\BorrowRequest;
use App\Models\Hold;
use App\Models\Loan;
use App\Models\MemberPresence;
use App\Models\RenewalRequest;
use App\Models\User;

class StatsService
{
    public function summary(): array
    {
        return [
            'totalMembers' => User::where('role', 'learner')->count(),
            'pendingApproval' => User::where('role', 'learner')
                ->where('membership_status', 'Pending')
                ->count(),
            'totalBooks' => Book::whereNull('archived_at')->count(),
            'staffAccounts' => auth()->user()?->role === 'admin' ? User::whereIn('role', ['admin', 'librarian'])->count() : null,
            'pendingRequests' => BorrowRequest::where('status', 'Pending')->count(),
            'pendingRenewals' => RenewalRequest::where('status', 'Pending')->count(),
            'readyHolds' => Hold::where('status', 'Ready')->count(),
            'waitingHolds' => Hold::where('status', 'Waiting')->count(),
            'overdueLoans' => Loan::where('status', 'Borrowed')->where('due_at', '<', now())->count(),
            'unassignedLoans' => Loan::where('status', 'Borrowed')->whereNull('book_copy_id')->count(),
            'occupancy' => MemberPresence::where('status', 'In library')->count(),
            'unavailableCopies' => BookCopy::whereIn('status', ['Damaged', 'Lost', 'Withdrawn'])->count(),
            'capacity' => app(SettingsService::class)->get()['capacity'],
            'recentLoans' => Loan::latest()->limit(5)->get(),
            'totalCopies' => BookCopy::count(),
            'activeLoans' => Loan::where('status', 'Borrowed')->count(),
            'todayCheckIns' => AttendanceRecord::whereDate('check_in_at', today())->count(),
            'availableCopies' => Book::whereNull('archived_at')->sum('available'),
        ];
    }
}
