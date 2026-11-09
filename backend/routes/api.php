<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes — AMG Library Backend
|--------------------------------------------------------------------------
| All routes are prefixed with /api/v1 via bootstrap/app.php
|
| Middleware aliases:
|   jwt.auth      — validates Bearer JWT, injects Auth::user()
|   role:librarian — requires librarian role (must come after jwt.auth)
*/

// ── Public routes (no authentication required) ──────────────────────────────
Route::get('/books',    [\App\Http\Controllers\BookController::class,     'index']);
Route::get('/ebooks',   [\App\Http\Controllers\EbookController::class,    'index']);
Route::get('/posts',    [\App\Http\Controllers\PostController::class,     'index']);
Route::get('/settings', [\App\Http\Controllers\SettingsController::class, 'show']);

// ── Auth routes (no token required) ─────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/register',       [\App\Http\Controllers\AuthController::class, 'register']);
    Route::post('/login',          [\App\Http\Controllers\AuthController::class, 'login']);
    Route::post('/password-reset', [\App\Http\Controllers\AuthController::class, 'passwordReset']);
});

// ── Authenticated routes (any role) ─────────────────────────────────────────
Route::middleware('jwt.auth')->group(function () {
    Route::get('/auth/me',          [\App\Http\Controllers\AuthController::class,   'me']);
    Route::patch('/auth/me',        [\App\Http\Controllers\AuthController::class,   'updateMe']);
    Route::post('/auth/me/photo',   [\App\Http\Controllers\AuthController::class,   'updatePhoto']);

    Route::get('/my/requests',      [\App\Http\Controllers\BorrowRequestController::class, 'myRequests']);
    Route::get('/my/loans',         [\App\Http\Controllers\LoanController::class,          'myLoans']);
    Route::post('/borrow-requests', [\App\Http\Controllers\BorrowRequestController::class, 'store']);

    Route::get('/ebooks/{id}/download-url', [\App\Http\Controllers\EbookController::class, 'downloadUrl']);
});

// ── Librarian-only routes ────────────────────────────────────────────────────
Route::middleware(['jwt.auth', 'role:librarian'])->group(function () {
    // Members
    Route::get('/members',                        [\App\Http\Controllers\MemberController::class, 'index']);
    Route::get('/members/pending',                [\App\Http\Controllers\MemberController::class, 'pending']);
    Route::post('/members/{uid}/review',          [\App\Http\Controllers\MemberController::class, 'review']);

    // Books
    Route::post('/books',                         [\App\Http\Controllers\BookController::class, 'store']);
    Route::delete('/books/{id}',                  [\App\Http\Controllers\BookController::class, 'destroy']);
    Route::get('/books/{id}/copies',              [\App\Http\Controllers\BookController::class, 'copies']);

    // Borrow requests
    Route::get('/borrow-requests',                [\App\Http\Controllers\BorrowRequestController::class, 'index']);
    Route::post('/borrow-requests/{id}/approve',  [\App\Http\Controllers\BorrowRequestController::class, 'approve']);
    Route::post('/borrow-requests/{id}/decline',  [\App\Http\Controllers\BorrowRequestController::class, 'decline']);

    // Loans
    Route::get('/loans',                          [\App\Http\Controllers\LoanController::class, 'index']);
    Route::post('/loans/{id}/return',             [\App\Http\Controllers\LoanController::class, 'returnLoan']);

    // Barcode circulation
    Route::post('/circulation/issue',             [\App\Http\Controllers\CirculationController::class, 'issue']);
    Route::post('/circulation/return',            [\App\Http\Controllers\CirculationController::class, 'returnCopy']);

    // Attendance
    Route::post('/attendance/check-in',           [\App\Http\Controllers\AttendanceController::class, 'checkIn']);
    Route::post('/attendance/check-out',          [\App\Http\Controllers\AttendanceController::class, 'checkOut']);
    Route::get('/attendance',                     [\App\Http\Controllers\AttendanceController::class, 'index']);

    // E-books
    Route::post('/ebooks',                        [\App\Http\Controllers\EbookController::class, 'store']);
    Route::delete('/ebooks/{id}',                 [\App\Http\Controllers\EbookController::class, 'destroy']);

    // Posts
    Route::post('/posts',                         [\App\Http\Controllers\PostController::class, 'store']);
    Route::delete('/posts/{type}/{id}',           [\App\Http\Controllers\PostController::class, 'destroy']);

    // Settings
    Route::put('/settings',                       [\App\Http\Controllers\SettingsController::class, 'update']);

    // Stats
    Route::get('/stats',                          [\App\Http\Controllers\StatsController::class, 'index']);
});
