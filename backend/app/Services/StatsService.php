<?php

namespace App\Services;

use App\Models\AttendanceRecord;
use App\Models\Book;
use App\Models\BookCopy;
use App\Models\Loan;
use App\Models\User;

class StatsService
{
    public function summary(): array
    {
        return [
            'totalMembers'     => User::where('role', 'learner')->count(),
            'pendingApproval'  => User::where('role', 'learner')
                                      ->where('membership_status', 'Pending')
                                      ->count(),
            'totalBooks'       => Book::count(),
            'totalCopies'      => BookCopy::count(),
            'activeLoans'      => Loan::where('status', 'Borrowed')->count(),
            'todayCheckIns'    => AttendanceRecord::whereDate('check_in_at', today())->count(),
            'availableCopies'  => Book::sum('available'),
        ];
    }
}
