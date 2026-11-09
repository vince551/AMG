# Implementation Plan: Laravel Backend

## Overview

Build a Laravel 11 REST API that replaces the existing Firebase backend for the AMG Library Management System. The implementation follows a layered architecture (routes → middleware → controllers → services → models) and uses `tymon/jwt-auth` for authentication, Eloquent ORM with MySQL/PostgreSQL, and `giorgiosironi/eris` for property-based tests.

## Tasks

- [x] 1. Project setup and core infrastructure
  - Scaffold a new Laravel 11 project
  - Install `tymon/jwt-auth`, `fruitcake/laravel-cors`, `giorgiosironi/eris`, and configure them
  - Configure `.env` with `APP_URL`, `DB_*`, `JWT_SECRET`, `FILESYSTEM_DISK`, and `CORS_ALLOWED_ORIGINS`
  - Register the global exception handler in `App\Exceptions\Handler` mapping `ValidationException` → 422, `AuthenticationException` → 401, `AuthorizationException` → 403, `ModelNotFoundException` → 404, custom `ConflictException` → 409, and all other `Throwable` → 500 (no stack trace in response body)
  - Create the `ConflictException` custom exception class
  - Add CORS middleware and ensure it runs on all routes
  - Set up `tests/Property/` directory and a base `PropertyTestCase` with `use TestTrait` and `$erisIterations = 100`
  - _Requirements: 14.1, 17.1, 17.4, 17.5_

- [x] 2. Database migrations and Eloquent models
  - [x] 2.1 Create migrations for all tables: `users`, `member_numbers`, `books`, `book_copies`, `borrow_requests`, `loans`, `attendance_records`, `member_presences`, `ebooks`, `posts`, `settings` — with columns, types, ENUMs, indexes, and foreign keys exactly as specified in the design
    - _Requirements: 1.1, 1.8, 1.9, 1.10, 4.2, 4.7, 5.1, 6.1, 7.1, 9.1, 9.7, 10.1, 11.1, 12.1, 13.4_

  - [x] 2.2 Create Eloquent models with `$fillable`, casts, and relationships: `User`, `MemberNumber`, `Book`, `BookCopy`, `BorrowRequest`, `Loan`, `AttendanceRecord`, `MemberPresence`, `Ebook`, `Post`, `Setting`
    - Hide `guardian_name`, `guardian_relation`, `guardian_phone`, `password` from default serialisation on `User`
    - _Requirements: 14.5_

  - [x] 2.3 Create model factories for all models (needed for seeding and tests)
    - _Requirements: (supports all test tasks)_

- [x] 3. Authentication — registration and login
  - [x] 3.1 Implement `AuthService::register()`: validate all required fields, enforce ENUM constraints, generate `library_number` via `member_numbers` reservation table (retry up to 30 times for uniqueness), hash password with bcrypt, handle optional photo upload (≤ 5 MB, image MIME only — store and set `photo_url`; if oversized or wrong type, create account without photo and include `warning` in response), create user with `membership_status = "Pending"` and `is_approved = false`, issue and return JWT
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [ ]* 3.2 Write property test for registration default state (`RegistrationPropertyTest`)
    - **Property 1: Registration produces correct default state**
    - **Validates: Requirements 1.1, 1.2**

  - [ ]* 3.3 Write property test for library number uniqueness (`LibraryNumberUniquenessTest`)
    - **Property 2: Library numbers are unique across all members**
    - **Validates: Requirements 1.2**

  - [x] 3.4 Implement `AuthService::login()`: verify credentials, return 401 (non-distinguishing) on failure, return JWT + user profile on success
    - _Requirements: 2.1, 2.2_

  - [x] 3.5 Implement `AuthService::passwordReset()`: send reset email if address is registered; return 200 regardless (no email-existence leak)
    - _Requirements: 2.5, 2.6_

  - [x] 3.6 Create `JwtAuth` middleware: validate Bearer token, inject `Auth::user()`; return 401 on missing/expired/invalid token
    - _Requirements: 2.3, 2.4_

  - [x] 3.7 Create `RoleCheck` middleware: compare `Auth::user()->role` against required role; return 403 on mismatch
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 3.8 Wire `POST /auth/register`, `POST /auth/login`, and `POST /auth/password-reset` routes to `AuthController`
    - _Requirements: 2.1, 2.5_

  - [ ]* 3.9 Write property test for role enforcement (`RoleEnforcementTest`)
    - **Property 17: Role enforcement on protected endpoints**
    - **Validates: Requirements 14.2, 14.3**

- [x] 4. Member profile management
  - [x] 4.1 Implement `GET /auth/me`: return full user record including `libraryNumber`, `membershipStatus`, `isApproved`, `photoURL`, and all registration fields; include guardian fields only for owning member or librarian
    - _Requirements: 3.1, 14.5_

  - [x] 4.2 Implement `POST /auth/me/photo`: validate image ≤ 5 MB and image MIME type (JPEG, PNG, WebP); replace stored photo and return new `photoURL`; return 422 without modifying stored photo if invalid
    - _Requirements: 3.2, 3.3, 15.1, 15.2, 15.3, 15.5_

  - [x] 4.3 Implement `PATCH /auth/me`: allow only `photoURL` and `starredBookIds` to be changed; silently strip (or 422 on) any attempt to set `role`, `isApproved`, `membershipStatus`, `libraryNumber`, `email`, or `uid`
    - _Requirements: 3.4, 3.5_

  - [ ]* 4.4 Write property test for immutable fields (`ProfileImmutableFieldsTest`)
    - **Property 3: Immutable fields cannot be changed by member PATCH**
    - **Validates: Requirements 3.4, 3.5**

  - [ ]* 4.5 Write property test for guardian field privacy (`GuardianPrivacyTest`)
    - **Property 18: Guardian fields are not exposed to non-owners**
    - **Validates: Requirements 14.5**

- [x] 5. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Book catalogue and copy management
  - [x] 6.1 Implement `GET /books` (public): return all books ordered by `title` ascending; support `page` / `per_page` pagination
    - _Requirements: 4.1, 4.2, 17.6_

  - [ ]* 6.2 Write property test for catalogue sort order (`BookCatalogueSortTest`)
    - **Property 4: Public book catalogue is sorted by title**
    - **Validates: Requirements 4.1**

  - [x] 6.3 Implement `BookService::createBook()` inside `DB::transaction()`: validate `title` and `quantity` (1–400), optional `author`, `category`, `description`, and `coverFile` (store image → set `cover_url`); create one `book_copies` row per copy with unique barcode matching `AMG-COPY-[A-Z0-9]{18}` and `status = "Available"`; set `available = quantity`
    - _Requirements: 4.3, 4.4, 4.5, 4.7, 5.1, 5.2_

  - [ ]* 6.4 Write property test for book copy invariants (`BookCopyInvariantsTest`)
    - **Property 5: Book copy invariants hold at creation time**
    - **Validates: Requirements 4.3, 5.1, 5.2**

  - [x] 6.5 Implement `BookService::deleteBook()`: check `available == quantity`; if so, delete book record and associated cover file; otherwise return 409
    - _Requirements: 4.6, 15.2_

  - [x] 6.6 Implement `GET /books/{id}/copies` (librarian): return all `book_copies` rows for that book including `copyNumber`, `barcode`, and `status`
    - _Requirements: 5.3_

  - [x] 6.7 Wire `POST /books`, `DELETE /books/{id}`, `GET /books/{id}/copies` routes to `BookController` under librarian middleware; wire `GET /books` as public route
    - _Requirements: 4.1, 4.3, 4.6, 5.3, 14.4_

- [x] 7. Borrow requests
  - [x] 7.1 Implement `BorrowService::createRequest()`: check member is approved (403 if not), check `available > 0` (409 if not), check no existing `"Pending"` request for same member+book (409 if so); create `BorrowRequest` with `status = "Pending"` and return 201
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 7.2 Write property test for duplicate borrow rejection (`DuplicateBorrowTest`)
    - **Property 7: Duplicate borrow requests are rejected**
    - **Validates: Requirements 6.4**

  - [x] 7.3 Implement `BorrowService::approve()` inside `DB::transaction()`: re-check `available > 0` (409 if 0), create `Loan` with `status = "Borrowed"` and `due_at = borrowed_at + 14 days`, decrement `books.available` by 1, set borrow request `status = "Approved"`
    - _Requirements: 6.6, 6.7_

  - [ ]* 7.4 Write property test for borrow approval atomicity (`BorrowApprovalAtomicTest`)
    - **Property 6: Borrow approval is atomic and consistent**
    - **Validates: Requirements 6.6**

  - [x] 7.5 Implement `BorrowService::decline()`: set borrow request `status = "Declined"` without touching book availability
    - _Requirements: 6.8_

  - [x] 7.6 Implement `GET /my/requests` (any authenticated user): return only the calling member's borrow requests; support pagination
    - _Requirements: 6.5, 17.6_

  - [x] 7.7 Implement `GET /borrow-requests` (librarian): return all borrow requests ordered by `createdAt` descending; support pagination
    - _Requirements: 6.9, 17.6_

  - [x] 7.8 Wire `POST /borrow-requests`, `GET /borrow-requests`, `POST /borrow-requests/{id}/approve`, `POST /borrow-requests/{id}/decline`, `GET /my/requests` routes to `BorrowRequestController`
    - _Requirements: 6.1, 6.5, 6.6, 6.8, 6.9_

- [x] 8. Loan management and return
  - [x] 8.1 Implement `LoanService::returnLoan()` inside `DB::transaction()`: verify loan `status = "Borrowed"` (409 if not), set `status = "Returned"` and `returned_at`, increment `books.available` by 1
    - _Requirements: 7.1, 7.2_

  - [ ]* 8.2 Write property test for loan return atomicity (`LoanReturnAtomicTest`)
    - **Property 8: Loan return is atomic and consistent**
    - **Validates: Requirements 7.1, 7.2**

  - [x] 8.3 Implement `GET /loans` (librarian): return all loans ordered by `createdAt` descending; support pagination
    - _Requirements: 7.3, 17.6_

  - [x] 8.4 Implement `GET /my/loans` (authenticated member): return only the calling member's loans; support pagination
    - _Requirements: 7.4, 17.6_

  - [x] 8.5 Wire `POST /loans/{id}/return`, `GET /loans`, `GET /my/loans` routes to `LoanController`
    - _Requirements: 7.1, 7.3, 7.4_

- [ ] 9. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Barcode circulation (issue and return by scan)
  - [x] 10.1 Implement `CirculationService::issue()` inside `DB::transaction()`: look up member by `libraryNumber` (404 if not found), check `isApproved` (403 if not), look up `BookCopy` by `copyBarcode` (404 if not found), verify `BookCopy.status = "Available"` (409 if not), set copy `status = "Borrowed"`, decrement parent `books.available` by 1, create `Loan` with `due_at = now + 14 days`
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 10.2 Implement `CirculationService::return()` inside `DB::transaction()`: look up `BookCopy` by `copyBarcode`, find active loan for that copy (404 if none), set copy `status = "Available"`, increment parent `books.available` by 1, set loan `status = "Returned"` and `returned_at`
    - _Requirements: 8.5, 8.6_

  - [ ]* 10.3 Write property test for barcode circulation round-trip (`BarcodeCirculationTest`)
    - **Property 9: Barcode circulation round-trip restores book state**
    - **Validates: Requirements 8.1, 8.5**

  - [x] 10.4 Wire `POST /circulation/issue` and `POST /circulation/return` routes to `CirculationController` under librarian middleware
    - _Requirements: 8.1, 8.5_

- [x] 11. Attendance tracking
  - [x] 11.1 Implement `AttendanceService::checkIn()` inside `DB::transaction()`: look up member by `libraryNumber`, check Presence is not already `"In library"` (409), count current `"In library"` presences against capacity (409 if at limit), create `AttendanceRecord` with `status = "In library"` and `checkInAt = now`, upsert `MemberPresence` to `"In library"`
    - _Requirements: 9.1, 9.2, 9.3, 9.7_

  - [x] 11.2 Implement `AttendanceService::checkOut()` inside `DB::transaction()`: look up member by `libraryNumber`, verify Presence is `"In library"` (409 if not), update active `AttendanceRecord` `status = "Checked out"` and `checkOutAt = now`, upsert `MemberPresence` to `"Checked out"`
    - _Requirements: 9.4, 9.5, 9.7_

  - [ ]* 11.3 Write property test for check-in/check-out round-trip (`AttendanceRoundTripTest`)
    - **Property 10: Check-in/check-out round-trip restores presence state**
    - **Validates: Requirements 9.1, 9.4**

  - [ ]* 11.4 Write property test for capacity enforcement (`CapacityEnforcementTest`)
    - **Property 11: Capacity is never exceeded**
    - **Validates: Requirements 9.3**

  - [x] 11.5 Implement `GET /attendance` (librarian): return all attendance records ordered by `checkInAt` descending with configurable limit; support pagination
    - _Requirements: 9.6, 17.6_

  - [x] 11.6 Wire `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance` routes to `AttendanceController` under librarian middleware
    - _Requirements: 9.1, 9.4, 9.6_

- [x] 12. Membership approval
  - [x] 12.1 Implement `MemberService::reviewMembership()`: verify `membershipStatus = "Pending"` (409 if not); on `"Approved"` set `isApproved = true`, `membershipStatus = "Approved"`, `approvedAt`, `decisionBy`; on `"Denied"` set `isApproved = false`, `membershipStatus = "Denied"`, `deniedAt`, `decisionBy`
    - _Requirements: 10.1, 10.2, 10.3_

  - [ ]* 12.2 Write property test for membership decision (`MembershipDecisionTest`)
    - **Property 12: Membership decision is correctly applied**
    - **Validates: Requirements 10.1, 10.2, 10.3**

  - [x] 12.3 Implement `GET /members` (librarian): return all members ordered by `createdAt` descending; guard guardian fields per requirement 14.5; support pagination
    - _Requirements: 10.4, 14.5, 17.6_

  - [x] 12.4 Implement `GET /members/pending` (librarian): return only members where `isApproved = false` and `membershipStatus = "Pending"`
    - _Requirements: 10.5_

  - [x] 12.5 Wire `POST /members/{uid}/review`, `GET /members`, `GET /members/pending` routes to `MemberController` under librarian middleware
    - _Requirements: 10.1, 10.4, 10.5_

- [ ] 13. Checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. E-book management
  - [x] 14.1 Implement `EbookService::upload()`: validate file is PDF or EPUB (422 if not), validate size ≤ 30 MB (422 if exceeded), store file to the ebooks storage path, create `Ebook` record with `title`, `category`, `file_name`, `storage_path`, `size`, `uploaded_by`; if DB write fails, delete the orphaned file before re-throwing
    - _Requirements: 11.1, 11.2, 11.3, 15.1, 15.3_

  - [ ]* 14.2 Write property test for e-book upload record (`EbookUploadTest`)
    - **Property 13: E-book upload creates a correct record**
    - **Validates: Requirements 11.1**

  - [x] 14.3 Implement `GET /ebooks` (public): return all ebook metadata records (no file URLs) ordered by `createdAt` descending
    - _Requirements: 11.4, 14.4_

  - [x] 14.4 Implement `GET /ebooks/{id}/download-url` (authenticated): generate a signed URL expiring in ≤ 60 minutes and return it; return 401 if unauthenticated
    - _Requirements: 11.5, 11.6, 15.4_

  - [ ]* 14.5 Write property test for download URL auth guard (`EbookDownloadUrlTest`)
    - **Property 14: E-book download URL is time-limited and auth-guarded**
    - **Validates: Requirements 11.5, 11.6**

  - [x] 14.6 Implement `EbookService::delete()`: delete the ebook record and the stored file; log an error (but do not fail) if file deletion fails
    - _Requirements: 11.7, 15.2_

  - [x] 14.7 Wire `POST /ebooks`, `DELETE /ebooks/{id}` routes to `EbookController` under librarian middleware; wire `GET /ebooks` as public route; wire `GET /ebooks/{id}/download-url` under auth middleware
    - _Requirements: 11.1, 11.4, 11.5, 11.7, 14.4_

- [x] 15. News and events
  - [x] 15.1 Implement `PostService::publish()`: validate `title` and `body` (422 if missing), validate `type` is `"announcement"` or `"event"` (422 if not), create post with `createdAt` and `createdBy`; return 201
    - _Requirements: 12.1, 12.4_

  - [x] 15.2 Implement `GET /posts` (public): return a combined feed of announcements and events ordered by `date` (falling back to `createdAt`) descending, limited to 20 most recent per type; include `announcementKind` and `source` computed from `type` on each item
    - _Requirements: 12.2, 12.5_

  - [ ]* 15.3 Write property test for news/events feed format and order (`PostFeedPropertyTest`)
    - **Property 15: News/events feed is correctly formatted and ordered**
    - **Validates: Requirements 12.2, 12.5**

  - [x] 15.4 Implement `PostService::delete()`: delete post by `id` and `type`; return 200
    - _Requirements: 12.3_

  - [x] 15.5 Wire `POST /posts`, `DELETE /posts/{type}/{id}` routes to `PostController` under librarian middleware; wire `GET /posts` as public route
    - _Requirements: 12.1, 12.2, 12.3, 14.4_

- [x] 16. Library settings
  - [x] 16.1 Implement `SettingsService::update()`: validate `capacity` is integer 1–10,000 (422 if not); upsert the settings row; default to 100 if no row exists
    - _Requirements: 13.1, 13.2, 13.4_

  - [x] 16.2 Implement `GET /settings` (public): return current settings including `capacity`; default `capacity` to 100 if no row exists
    - _Requirements: 13.3, 13.4, 14.4_

  - [ ]* 16.3 Write property test for capacity round-trip (`CapacitySettingTest`)
    - **Property 16: Capacity setting round-trip**
    - **Validates: Requirements 13.1, 13.3**

  - [x] 16.4 Wire `PUT /settings` route to `SettingsController` under librarian middleware; wire `GET /settings` as public route
    - _Requirements: 13.1, 13.3_

- [x] 17. Statistics dashboard
  - [x] 17.1 Implement `StatsService::summary()`: return live aggregates — total members, pending approval count, total book titles, total book copies, currently active loans (`status = "Borrowed"`), today's check-in count, and total available copies
    - _Requirements: 16.1, 16.2_

  - [ ]* 17.2 Write property test for statistics accuracy (`StatisticsAccuracyTest`)
    - **Property 19: Statistics counts match live database state**
    - **Validates: Requirements 16.1**

  - [x] 17.3 Wire `GET /stats` route to `StatsController` under librarian middleware
    - _Requirements: 16.1_

- [x] 18. Pagination
  - [x] 18.1 Add `page` / `per_page` query parameter support to all list endpoints: `GET /members`, `GET /books`, `GET /loans`, `GET /borrow-requests`, `GET /attendance`, `GET /my/requests`, `GET /my/loans`; ensure the response envelope includes pagination metadata (`current_page`, `per_page`, `total`, `last_page`)
    - _Requirements: 17.6_

  - [ ]* 18.2 Write property test for pagination slicing (`PaginationPropertyTest`)
    - **Property 20: Pagination returns the correct slice**
    - **Validates: Requirements 17.6**

- [ ] 19. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- All multi-table mutations must be wrapped in `DB::transaction()`; the global exception handler converts uncaught exceptions to structured JSON responses
- Property tests live in `tests/Property/` and each references a design property number
- Unit/feature tests live in `tests/Feature/` and use `RefreshDatabase` + Laravel factories
