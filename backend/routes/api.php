<?php

use App\Http\Controllers\AttendanceController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookController;
use App\Http\Controllers\BorrowRequestController;
use App\Http\Controllers\CirculationController;
use App\Http\Controllers\EbookController;
use App\Http\Controllers\LoanController;
use App\Http\Controllers\MemberController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\StatsController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WorkflowController;
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
Route::get('/books', [BookController::class,     'index']);
Route::get('/ebooks', [EbookController::class,    'index']);
Route::get('/posts', [PostController::class,     'index']);
Route::get('/settings', [SettingsController::class, 'show']);

// ── Auth routes (no token required) ─────────────────────────────────────────
Route::prefix('auth')->middleware('throttle:10,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/password-reset', [AuthController::class, 'passwordReset']);
    Route::post('/password-reset/confirm', [AuthController::class, 'completePasswordReset']);
});

// ── Authenticated routes (any role) ─────────────────────────────────────────
Route::middleware('jwt.auth')->group(function () {
    Route::post('/auth/password', [AuthController::class, 'changePassword'])->middleware('throttle:10,1');
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/my/overview', [WorkflowController::class, 'overview']);
    Route::get('/my/saved-books', [BookController::class, 'index']);
    Route::get('/my/attendance', [AttendanceController::class, 'index']);
    Route::get('/my/holds', [WorkflowController::class, 'holds']);
    Route::post('/my/holds', [WorkflowController::class, 'createHold']);
    Route::post('/my/holds/{id}/cancel', [WorkflowController::class, 'cancelHold']);
    Route::get('/my/renewals', [WorkflowController::class, 'renewals']);
    Route::post('/my/loans/{id}/renew', [WorkflowController::class, 'requestRenewal']);
    Route::post('/my/requests/{id}/cancel', [BorrowRequestController::class, 'cancel']);
    Route::get('/my/notifications', [WorkflowController::class, 'notifications']);
    Route::post('/my/notifications/read', [WorkflowController::class, 'readNotifications']);
    Route::get('/auth/me', [AuthController::class,   'me']);
    Route::patch('/auth/me', [AuthController::class,   'updateMe']);
    Route::post('/auth/me/photo', [AuthController::class,   'updatePhoto']);

    Route::get('/my/requests', [BorrowRequestController::class, 'myRequests']);
    Route::get('/my/loans', [LoanController::class,          'myLoans']);
    Route::post('/borrow-requests', [BorrowRequestController::class, 'store']);

    Route::get('/ebooks/{id}/download-url', [EbookController::class, 'downloadUrl']);
});

// ── Librarian-only routes ────────────────────────────────────────────────────
Route::middleware(['jwt.auth', 'role:librarian'])->group(function () {
    // Members
    Route::get('/members', [UserController::class, 'index']);
    Route::post('/members', [UserController::class, 'store']);
    Route::get('/members/{uid}', [UserController::class, 'show'])->whereUuid('uid');
    Route::patch('/members/{uid}', [UserController::class, 'update']);
    Route::get('/members/pending', [MemberController::class, 'pending']);
    Route::post('/members/{uid}/review', [MemberController::class, 'review']);

    // Books
    Route::get('/inventory/books', [BookController::class, 'index']);
    Route::patch('/books/{id}', [BookController::class, 'update']);
    Route::post('/books/{id}/restore', [BookController::class, 'restore']);
    Route::post('/books/{id}/copies', [BookController::class, 'addCopies']);
    Route::patch('/copies/{id}', [BookController::class, 'updateCopy']);
    Route::post('/books', [BookController::class, 'store']);
    Route::delete('/books/{id}', [BookController::class, 'destroy']);
    Route::get('/books/{id}/copies', [BookController::class, 'copies']);

    // Borrow requests
    Route::get('/borrow-requests', [BorrowRequestController::class, 'index']);
    Route::post('/borrow-requests/{id}/approve', [BorrowRequestController::class, 'approve']);
    Route::post('/borrow-requests/{id}/decline', [BorrowRequestController::class, 'decline']);

    // Loans
    Route::post('/loans/{id}/reconcile', [WorkflowController::class, 'reconcileLoan']);
    Route::get('/holds', [WorkflowController::class, 'holds']);
    Route::post('/holds/{id}/cancel', [WorkflowController::class, 'cancelHold']);
    Route::get('/renewals', [WorkflowController::class, 'renewals']);
    Route::post('/renewals/{id}/review', [WorkflowController::class, 'reviewRenewal']);
    Route::get('/reports/{type}', [ReportController::class, 'index']);
    Route::get('/loans', [LoanController::class, 'index']);
    Route::post('/loans/{id}/return', [LoanController::class, 'returnLoan']);

    // Barcode circulation
    Route::post('/circulation/issue', [CirculationController::class, 'issue']);
    Route::post('/circulation/return', [CirculationController::class, 'returnCopy']);

    // Attendance
    Route::post('/attendance/check-in', [AttendanceController::class, 'checkIn']);
    Route::post('/attendance/check-out', [AttendanceController::class, 'checkOut']);
    Route::get('/attendance', [AttendanceController::class, 'index']);

    // E-books
    Route::patch('/ebooks/{id}', [EbookController::class, 'update']);
    Route::post('/ebooks', [EbookController::class, 'store']);
    Route::delete('/ebooks/{id}', [EbookController::class, 'destroy']);

    // Posts
    Route::get('/content/posts', [PostController::class, 'index']);
    Route::patch('/posts/{id}', [PostController::class, 'update']);
    Route::post('/posts', [PostController::class, 'store']);
    Route::delete('/posts/{type}/{id}', [PostController::class, 'destroy']);

    // Stats
    Route::get('/stats', [StatsController::class, 'index']);
});

Route::middleware(['jwt.auth', 'role:admin'])->group(function () {
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::get('/users/{uid}', [UserController::class, 'show']);
    Route::patch('/users/{uid}', [UserController::class, 'update']);
    Route::post('/users/{uid}/credentials', [UserController::class, 'resetCredential'])->middleware('throttle:10,1');
    Route::get('/activity', [WorkflowController::class, 'activity']);
    Route::put('/settings', [SettingsController::class, 'update']);
});
