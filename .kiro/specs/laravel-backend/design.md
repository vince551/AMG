# Design Document — Laravel Backend

## Overview

The Laravel backend replaces Firebase (Firestore, Firebase Auth, Cloud Storage, Firebase Functions) with a conventional REST API. The existing React/Vite PWA continues to run unchanged on Vercel; only the data layer it calls changes.

### Goals

- Drop-in replacement for every Firebase operation the frontend performs today
- JWT-based stateless authentication (no sessions)
- Role-based access control: `librarian` and `learner`
- Consistent JSON responses and HTTP status codes that match frontend expectations
- Signed URLs for e-book downloads (≤ 60 min TTL)
- Atomic database operations for any action that touches multiple tables

### Non-goals

- Real-time push / WebSockets (the frontend polls on navigation)
- Multi-library / multi-tenant support
- Mobile push notifications

### Technology choices

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Laravel 11 | Mature PHP framework, Eloquent ORM, queues, file storage, first-class JWT support |
| Authentication | `tymon/jwt-auth` | Battle-tested Laravel JWT package, widely used |
| Database | MySQL 8 (or PostgreSQL 15) | Relational integrity for transactions; Eloquent works identically on both |
| File storage | Laravel Storage (local disk + optional S3) | Filesystem abstraction; signed URL generation built in |
| Property-based tests | `giorgiosironi/eris` | PHP property-based testing library |

---

## Architecture

The API follows a standard Laravel layered architecture:

```
React PWA (Vercel)
        │  HTTPS + JWT
        ▼
┌──────────────────────────────────────────┐
│              Laravel API                 │
│  routes/api.php                          │
│     │                                    │
│  Middleware                              │
│  ├── CORS (fruitcake/laravel-cors)       │
│  ├── JwtAuth (authenticate)             │
│  └── RoleCheck (librarian / learner)    │
│     │                                    │
│  Controllers  (thin, delegate to service) │
│     │                                    │
│  Services     (business logic)           │
│     │                                    │
│  Models / Eloquent ORM                   │
│     │                                    │
│  MySQL / PostgreSQL                      │
│     │                                    │
│  Laravel Storage (disk / S3)             │
└──────────────────────────────────────────┘
```

### Request lifecycle

1. CORS middleware adds appropriate headers on every response.
2. `JwtAuth` middleware validates the Bearer token and injects `Auth::user()`.
3. `RoleCheck` middleware compares `user->role` against the required role for the route.
4. Controller delegates to a service class, returns a JSON response.
5. `Handler::render` catches unhandled exceptions and maps them to structured JSON errors.

---

## Components and Interfaces

### Route groups

```
/api/v1
├── PUBLIC (no auth)
│   ├── GET    /books
│   ├── GET    /ebooks
│   ├── GET    /posts          (news + events combined feed)
│   └── GET    /settings
│
├── AUTH REQUIRED (any role)
│   ├── POST   /auth/register
│   ├── POST   /auth/login
│   ├── POST   /auth/password-reset
│   ├── GET    /auth/me
│   ├── POST   /auth/me/photo
│   ├── PATCH  /auth/me
│   ├── GET    /my/requests
│   ├── GET    /my/loans
│   ├── POST   /borrow-requests
│   └── GET    /ebooks/{id}/download-url
│
└── LIBRARIAN ONLY
    ├── GET    /members
    ├── GET    /members/pending
    ├── POST   /members/{uid}/review
    ├── POST   /books
    ├── DELETE /books/{id}
    ├── GET    /books/{id}/copies
    ├── GET    /borrow-requests
    ├── POST   /borrow-requests/{id}/approve
    ├── POST   /borrow-requests/{id}/decline
    ├── GET    /loans
    ├── POST   /loans/{id}/return
    ├── POST   /circulation/issue
    ├── POST   /circulation/return
    ├── POST   /attendance/check-in
    ├── POST   /attendance/check-out
    ├── GET    /attendance
    ├── POST   /ebooks
    ├── DELETE /ebooks/{id}
    ├── POST   /posts
    ├── DELETE /posts/{type}/{id}
    ├── PUT    /settings
    └── GET    /stats
```

### Service classes

| Service | Responsibilities |
|---|---|
| `AuthService` | Register, login, JWT issue, password reset |
| `MemberService` | Profile read/update, photo upload/replace |
| `BookService` | Create book + copies (DB transaction), delete, list |
| `BorrowService` | Create request, approve (transaction), decline |
| `LoanService` | Return loan (transaction), list |
| `CirculationService` | Barcode issue (transaction), barcode return (transaction) |
| `AttendanceService` | Check-in (transaction), check-out (transaction), capacity guard |
| `EbookService` | Upload, delete, signed URL |
| `PostService` | Publish announcement/event, delete, combined feed |
| `SettingsService` | Read/update capacity |
| `StatsService` | Aggregate counts from live data |

---

## Data Models

All timestamps are stored as UTC. Laravel Eloquent timestamps (`created_at`, `updated_at`) are used throughout.

### users

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK auto | Internal primary key |
| uid | VARCHAR(36) UNIQUE | UUID, used as the JWT `sub` and external identifier |
| email | VARCHAR(191) UNIQUE |  |
| password | VARCHAR(255) | bcrypt hash |
| full_name | VARCHAR(160) |  |
| gender | ENUM | Male, Female, Other, Prefer not to say |
| school | VARCHAR(191) |  |
| study_level | VARCHAR(100) |  |
| edu_level | ENUM | PP / Pre-Primary, Primary, Junior Secondary, Senior Secondary, High School, University |
| guardian_name | VARCHAR(160) |  |
| guardian_relation | ENUM | Mother, Father, Guardian |
| guardian_phone | VARCHAR(40) |  |
| library_number | VARCHAR(20) UNIQUE | AMG-XXXXXX |
| role | ENUM | librarian, learner |
| is_approved | BOOLEAN DEFAULT false |  |
| membership_status | ENUM | Pending, Approved, Denied |
| photo_url | VARCHAR(500) NULLABLE |  |
| starred_book_ids | JSON DEFAULT '[]' |  |
| approved_at | TIMESTAMP NULLABLE |  |
| denied_at | TIMESTAMP NULLABLE |  |
| decision_by | VARCHAR(36) NULLABLE | uid of librarian |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

### member_numbers

| Column | Type | Notes |
|---|---|---|
| library_number | VARCHAR(20) PK | Reservation lock to guarantee uniqueness |
| uid | VARCHAR(36) |  |
| created_at | TIMESTAMP |  |

### books

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK auto |  |
| title | VARCHAR(160) |  |
| author | VARCHAR(120) NULLABLE |  |
| category | ENUM | PP / Pre-Primary … Other |
| quantity | SMALLINT | 1–400 |
| available | SMALLINT | Maintained atomically |
| cover_url | VARCHAR(500) NULLABLE |  |
| cover_storage_path | VARCHAR(500) NULLABLE |  |
| description | VARCHAR(500) NULLABLE |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

### book_copies

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK auto |  |
| book_id | BIGINT FK → books.id |  |
| copy_number | SMALLINT | Sequential within the book |
| barcode | VARCHAR(40) UNIQUE | AMG-COPY-XXXXXXXXXXXXXXXXXX |
| status | ENUM | Available, Borrowed |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

### borrow_requests

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK auto |  |
| user_id | VARCHAR(36) FK → users.uid |  |
| user_name | VARCHAR(160) | Denormalised for display |
| book_id | BIGINT FK → books.id |  |
| book_title | VARCHAR(160) | Denormalised |
| book_category | VARCHAR(60) | Denormalised |
| status | ENUM | Pending, Approved, Declined, Returned |
| loan_id | BIGINT NULLABLE FK → loans.id |  |
| processed_at | TIMESTAMP NULLABLE |  |
| processed_by | VARCHAR(36) NULLABLE |  |
| returned_at | TIMESTAMP NULLABLE |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

### loans

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK auto |  |
| user_id | VARCHAR(36) FK → users.uid |  |
| user_name | VARCHAR(160) | Denormalised |
| book_id | BIGINT FK → books.id |  |
| book_title | VARCHAR(160) | Denormalised |
| book_category | VARCHAR(60) | Denormalised |
| book_copy_id | BIGINT NULLABLE FK → book_copies.id | Set when issued via barcode scan |
| status | ENUM | Borrowed, Returned |
| borrowed_at | TIMESTAMP |  |
| due_at | TIMESTAMP |  |
| returned_at | TIMESTAMP NULLABLE |  |
| issued_by | VARCHAR(36) NULLABLE |  |
| returned_by | VARCHAR(36) NULLABLE |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

### attendance_records

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK auto |  |
| uid | VARCHAR(36) FK → users.uid |  |
| member_name | VARCHAR(160) | Denormalised |
| library_number | VARCHAR(20) |  |
| check_in_at | TIMESTAMP |  |
| check_out_at | TIMESTAMP NULLABLE |  |
| status | ENUM | In library, Checked out |
| recorded_by | VARCHAR(36) NULLABLE |  |
| checked_out_by | VARCHAR(36) NULLABLE |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

### member_presences

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK auto |  |
| uid | VARCHAR(36) UNIQUE FK → users.uid |  |
| attendance_id | BIGINT NULLABLE FK → attendance_records.id | Active record |
| status | ENUM | In library, Checked out |
| updated_at | TIMESTAMP |  |

### ebooks

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK auto |  |
| title | VARCHAR(160) |  |
| category | VARCHAR(60) |  |
| file_name | VARCHAR(255) |  |
| storage_path | VARCHAR(500) |  |
| size | BIGINT | Bytes |
| uploaded_by | VARCHAR(36) |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

### posts

Announcements and events are stored in a single table with a `type` discriminator.

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK auto |  |
| type | ENUM | announcement, event |
| title | VARCHAR(255) |  |
| body | TEXT |  |
| date | DATE NULLABLE | Optional event date |
| created_by | VARCHAR(36) |  |
| created_at | TIMESTAMP |  |
| updated_at | TIMESTAMP |  |

### settings

| Column | Type | Notes |
|---|---|---|
| id | BIGINT PK auto |  |
| key | VARCHAR(60) UNIQUE | e.g. `library` |
| capacity | SMALLINT DEFAULT 100 |  |
| updated_at | TIMESTAMP |  |
| updated_by | VARCHAR(36) NULLABLE |  |

---

### Key design decisions

**UUID `uid` vs auto-increment `id`**  
Users have both an internal `id` (BIGINT) and an externally visible `uid` (UUID). The frontend references users by `uid` (matching the Firebase `uid` shape), but foreign keys inside the DB use `uid` too, since user identity is UUID-scoped.

**Denormalised name/title columns**  
Borrow requests and loans store `user_name`, `book_title`, and `book_category` as snapshots at creation time. This mirrors the Firebase document structure the frontend already expects, avoids joins on list endpoints, and preserves historical display even if the source record is later updated.

**Single `posts` table**  
Announcements and events share identical fields. A `type` ENUM discriminator is simpler than two tables and matches the combined feed endpoint the frontend expects. The response includes `announcementKind` and `source` fields computed from `type`.

**`member_presences` as a separate table**  
Presence is a current-state record (one row per member, upserted). `attendance_records` is append-only history. Keeping them separate allows querying current occupancy in O(1) via `COUNT(*) WHERE status = 'In library'` without scanning history.

**Atomic operations**  
All multi-table mutations (book issue, book return, borrow approval, check-in, check-out) use `DB::transaction()`. Laravel's database transaction helper ensures all-or-nothing semantics with automatic rollback on exception.


---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Registration produces correct default state

*For any* valid registration payload (unique email, password ≥ 8 chars, all required fields present), calling the register endpoint should return a JWT and the created user should have `membership_status = "Pending"`, `is_approved = false`, and a `library_number` matching `AMG-\d{6}`.

**Validates: Requirements 1.1, 1.2**

---

### Property 2: Library numbers are unique across all members

*For any* set of N successfully registered members (N ≥ 2), all `library_number` values in the set should be pairwise distinct.

**Validates: Requirements 1.2**

---

### Property 3: Immutable fields cannot be changed by member PATCH

*For any* authenticated member, submitting a PATCH `/auth/me` payload that includes any combination of `role`, `is_approved`, `membership_status`, `library_number`, `email`, or `uid` should leave those fields unchanged in the database after the request completes.

**Validates: Requirements 3.4, 3.5**

---

### Property 4: Public book catalogue is sorted by title

*For any* set of books in the database, the response from `GET /books` should return records ordered lexicographically ascending by `title`.

**Validates: Requirements 4.1**

---

### Property 5: Book copy invariants hold at creation time

*For any* book creation request with quantity Q (1 ≤ Q ≤ 400), after a successful response: (a) exactly Q `book_copies` rows exist for that book, (b) every barcode matches `AMG-COPY-[A-Z0-9]{18}`, (c) all barcodes are pairwise distinct within and across books, and (d) each copy has `status = "Available"`.

**Validates: Requirements 4.3, 5.1, 5.2**

---

### Property 6: Borrow approval is atomic and consistent

*For any* Pending borrow request where the book has at least one available copy, when a Librarian approves the request: (a) a Loan is created with `status = "Borrowed"` and `due_at` set exactly 14 days from `borrowed_at`, (b) `books.available` is decremented by exactly 1, and (c) the borrow request `status` becomes `"Approved"`.

**Validates: Requirements 6.6**

---

### Property 7: Duplicate borrow requests are rejected

*For any* approved member and any book, if that member already has a `"Pending"` borrow request for that book, submitting a second borrow request should return 409 and the borrow request count for that member+book pair should remain unchanged.

**Validates: Requirements 6.4**

---

### Property 8: Loan return is atomic and consistent

*For any* active Loan with `status = "Borrowed"`, when a Librarian submits a return: (a) the Loan `status` becomes `"Returned"` and `returned_at` is set, (b) `books.available` is incremented by exactly 1, and (c) subsequent return attempts on the same loan return 409.

**Validates: Requirements 7.1, 7.2**

---

### Property 9: Barcode circulation round-trip restores book state

*For any* available book copy and any approved member, issuing the copy by barcode scan then returning it by barcode scan should leave `books.available` and `book_copies.status` unchanged from their values before the issue.

**Validates: Requirements 8.1, 8.5**

---

### Property 10: Check-in/check-out round-trip restores presence state

*For any* approved member who is currently "Checked out", performing a check-in followed by a check-out should result in the member's presence `status` returning to `"Checked out"` and the attendance record having both `check_in_at` and `check_out_at` set.

**Validates: Requirements 9.1, 9.4**

---

### Property 11: Capacity is never exceeded

*For any* library with configured capacity C, the count of members with presence `status = "In library"` should never exceed C. A check-in request that would cause the count to reach C+1 should return 409.

**Validates: Requirements 9.3**

---

### Property 12: Membership decision is correctly applied

*For any* Pending member, when a Librarian submits an approval decision of `"Approved"`, the member should have `is_approved = true` and `membership_status = "Approved"`. When the decision is `"Denied"`, `is_approved = false` and `membership_status = "Denied"`. Submitting any decision for a non-Pending member should return 409.

**Validates: Requirements 10.1, 10.2, 10.3**

---

### Property 13: E-book upload creates a correct record

*For any* valid PDF or EPUB file ≤ 30 MB, uploading via the Librarian endpoint should create an ebook record containing `title`, `category`, `file_name`, `storage_path`, `size`, and `uploaded_by`, and return 201. The stored `size` should equal the uploaded file's byte size.

**Validates: Requirements 11.1**

---

### Property 14: E-book download URL is time-limited and auth-guarded

*For any* uploaded e-book, an authenticated member requesting a download URL should receive a signed URL that is not empty. The same request without authentication should return 401.

**Validates: Requirements 11.5, 11.6**

---

### Property 15: News/events feed is correctly formatted and ordered

*For any* set of posts in the database, the `GET /posts` response should: (a) order items by `date` (falling back to `created_at`) descending, (b) include `announcementKind` (`"Announcement"` or `"Event"`) and `source` (`"announcements"` or `"events"`) on every item.

**Validates: Requirements 12.2, 12.5**

---

### Property 16: Capacity setting round-trip

*For any* valid integer C (1 ≤ C ≤ 10,000), after a Librarian updates capacity to C, a subsequent `GET /settings` should return `capacity = C`.

**Validates: Requirements 13.1, 13.3**

---

### Property 17: Role enforcement on protected endpoints

*For any* Librarian-only endpoint, a request carrying a `learner` JWT should return 403, and a request with no JWT should return 401. *For any* Member-only endpoint, a request with no JWT should return 401.

**Validates: Requirements 14.2, 14.3**

---

### Property 18: Guardian fields are not exposed to non-owners

*For any* member record returned to a requester who is neither the owning member nor a Librarian, the response should not contain `guardian_phone`, `guardian_name`, or `guardian_relation`.

**Validates: Requirements 14.5**

---

### Property 19: Statistics counts match live database state

*For any* known database state, the response from `GET /stats` should return counts that exactly match direct SQL aggregations: total members, pending count, total books, total copies, active loans, today's check-ins, and total available copies.

**Validates: Requirements 16.1**

---

### Property 20: Pagination returns the correct slice

*For any* list endpoint supporting pagination, a request with `page=P` and `per_page=N` should return at most N items and the items should correspond to the correct offset `(P-1)*N` in the full ordered result set.

**Validates: Requirements 17.6**

---

## Error Handling

### Global exception handler

`App\Exceptions\Handler` maps exception types to HTTP responses:

| Exception | HTTP status | Response body |
|---|---|---|
| `ValidationException` | 422 | `{ "message": "...", "errors": { "field": ["..."] } }` |
| `AuthenticationException` | 401 | `{ "message": "Unauthenticated." }` |
| `AuthorizationException` | 403 | `{ "message": "Forbidden." }` |
| `ModelNotFoundException` | 404 | `{ "message": "Resource not found." }` |
| `ConflictException` (custom) | 409 | `{ "message": "..." }` |
| Any other `Throwable` | 500 | `{ "message": "An unexpected error occurred." }` (+ full log) |

### Stack trace policy

- 500 responses never include stack traces in the response body.
- Laravel's `LOG_CHANNEL` (stdout or file) captures the full exception with context.
- Local development may set `APP_DEBUG=true` in `.env` to enable stack traces in responses.

### Atomic operation failures

All `DB::transaction()` blocks throw exceptions on any failure, causing automatic rollback. The controller catches the exception and returns the appropriate mapped response. No partial state is persisted.

### File operation failures

File storage errors (upload/delete) are caught separately from database errors. If a file is uploaded but the subsequent database write fails, the orphaned file is deleted before re-throwing the exception. If file deletion fails on record deletion, the record deletion still succeeds and the error is logged — orphan cleanup is a separate concern.

---

## Testing Strategy

### Dual approach

Unit tests cover specific examples, edge cases, and error conditions. Property-based tests verify universal properties across randomly generated inputs. Both are required for complete coverage.

### Unit / feature tests (PHPUnit)

Laravel's built-in `Tests\Feature` test classes use `RefreshDatabase` to run each test against a fresh schema. Use Laravel factories to seed data.

Focus areas:
- Specific error examples (duplicate email → 409, wrong password → 401, unapproved member → 403)
- Edge cases at boundaries (password = 7 chars, password = 8 chars; quantity = 0, quantity = 1, quantity = 400, quantity = 401)
- Integration between components (registration + login + profile retrieval)
- Auth guard checks on each protected route group

### Property-based tests (Eris)

Use [`giorgiosironi/eris`](https://github.com/giorgiosironi/eris) for PHP property-based testing. Each property test runs a minimum of 100 iterations. Tests are placed in `tests/Property/`.

Configuration per test class:
```php
use Eris\TestTrait;

class SomePropertyTest extends TestCase
{
    use TestTrait;
    protected $erisIterations = 100;
}
```

Each test is tagged with a comment referencing the design property:
```php
// Feature: laravel-backend, Property 1: Registration produces correct default state
```

#### Property test mapping

| Property | Test class | Generators |
|---|---|---|
| P1 – Registration default state | `RegistrationPropertyTest` | Random names, emails, passwords (≥ 8 chars), valid enums |
| P2 – Library numbers unique | `LibraryNumberUniquenessTest` | N registrations (N = 2..20) |
| P3 – Immutable fields | `ProfileImmutableFieldsTest` | Random PATCH payloads containing protected fields |
| P4 – Catalogue sort order | `BookCatalogueSortTest` | Random sets of book titles in random insertion order |
| P5 – Book copy invariants | `BookCopyInvariantsTest` | Random quantities (1–400) |
| P6 – Borrow approval atomic | `BorrowApprovalAtomicTest` | Random member + book pairs |
| P7 – Duplicate borrow rejected | `DuplicateBorrowTest` | Random member + book pairs |
| P8 – Loan return atomic | `LoanReturnAtomicTest` | Random loans |
| P9 – Barcode circulation round-trip | `BarcodeCirculationTest` | Random book copies and members |
| P10 – Check-in/out round-trip | `AttendanceRoundTripTest` | Random approved members |
| P11 – Capacity never exceeded | `CapacityEnforcementTest` | Random capacity values and member counts |
| P12 – Membership decision | `MembershipDecisionTest` | Random pending members and decisions |
| P13 – E-book upload record | `EbookUploadTest` | Random PDF/EPUB file stubs |
| P14 – Download URL auth guard | `EbookDownloadUrlTest` | Random ebook records |
| P15 – Feed format and order | `PostFeedPropertyTest` | Random sets of posts with random dates |
| P16 – Capacity round-trip | `CapacitySettingTest` | Random valid capacity integers |
| P17 – Role enforcement | `RoleEnforcementTest` | Enumerated list of protected routes |
| P18 – Guardian field privacy | `GuardianPrivacyTest` | Random member payloads, random requesters |
| P19 – Stats accuracy | `StatisticsAccuracyTest` | Random known database states |
| P20 – Pagination slicing | `PaginationPropertyTest` | Random page/per_page, random record counts |
