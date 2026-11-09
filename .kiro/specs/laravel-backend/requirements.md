# Requirements Document

## Introduction

This document defines the requirements for a Laravel REST API backend that replaces the existing Firebase (Firestore + Firebase Auth + Cloud Storage + Firebase Functions) backend for the AMG Library Management System.

The existing frontend is a React (Vite/JSX) PWA deployed on Vercel. It currently communicates directly with Firebase services. The goal is to build a Laravel API that the frontend can call instead, keeping the same user-facing capabilities: member registration and authentication, book catalogue management, physical copy barcode circulation, e-book management, attendance tracking, news/events publishing, and a librarian dashboard.

The Laravel backend must be consumable by the existing React frontend over HTTP with JWT-based authentication and standard JSON responses.

---

## Glossary

- **API**: The Laravel HTTP REST API being specified in this document.
- **Member**: A registered library user with the `learner` role who has completed registration and is pending or approved.
- **Librarian**: A privileged staff user with the `librarian` role. Only one librarian account is expected, but the system must support any number.
- **Library_Number**: A unique member identifier in the format `AMG-XXXXXX` (AMG followed by six digits), e.g. `AMG-123456`.
- **Book**: A catalogue title record with metadata (title, author, category, quantity, available copies, optional cover image).
- **Book_Copy**: An individual physical copy of a Book, identified by a unique barcode in the format `AMG-COPY-XXXX`.
- **Borrow_Request**: A request submitted by an approved Member to borrow a Book title, subject to librarian approval.
- **Loan**: An active or historical record of a Book_Copy being borrowed by a Member, with an issue date and due date.
- **Attendance_Record**: A record of a Member checking in or out of the physical library space.
- **Presence**: The current in-library status of a Member (either "In library" or "Checked out").
- **E-book**: A digital book file (PDF or EPUB) uploaded by the Librarian and available for download by authenticated Members.
- **Announcement**: A public post of type "Announcement" published by the Librarian.
- **Event**: A public post of type "Event" published by the Librarian.
- **JWT**: JSON Web Token used for stateless API authentication.
- **Loan_Period**: The fixed borrowing duration of 14 days from the issue date.
- **Capacity**: The maximum number of Members that may be simultaneously present in the library. Configurable by the Librarian.

---

## Requirements

### Requirement 1: Authentication — Member Registration

**User Story:** As a prospective member, I want to register with my personal details, so that I can apply for library membership.

#### Acceptance Criteria

1. WHEN a registration request is received with valid `fullName`, `email`, `password`, `gender`, `school`, `studyLevel`, `eduLevel`, `guardianName`, `guardianRelation`, and `guardianPhone` fields, THE API SHALL create a Member account, assign a unique Library_Number, set `membershipStatus` to `"Pending"`, set `isApproved` to `false`, and return a JWT.
2. WHEN a registration request is received, THE API SHALL assign a Library_Number in the format `AMG-XXXXXX` where X is a digit, and SHALL retry up to 30 times to guarantee uniqueness before returning an error.
3. IF a registration request is received with a `password` shorter than 8 characters, THEN THE API SHALL return a 422 error with a descriptive validation message.
4. IF a registration request is received with an `email` that is already registered, THEN THE API SHALL return a 409 error.
5. IF a registration request is received with a missing required field, THEN THE API SHALL return a 422 error listing the missing fields.
6. WHERE a `photo` file is included in the registration request, THE API SHALL store the image and associate its URL with the Member profile, provided the file is an image type and does not exceed 5 MB.
7. IF a `photo` file exceeds 5 MB or is not an image type, THEN THE API SHALL create the Member account without a photo and return a warning in the response.
8. THE API SHALL accept `gender` values only from the set: `Male`, `Female`, `Other`, `Prefer not to say`.
9. THE API SHALL accept `guardianRelation` values only from the set: `Mother`, `Father`, `Guardian`.
10. THE API SHALL accept `eduLevel` values only from the set: `PP / Pre-Primary`, `Primary`, `Junior Secondary`, `Senior Secondary`, `High School`, `University`.

---

### Requirement 2: Authentication — Login and Token Management

**User Story:** As a registered user, I want to log in and receive a token, so that I can access protected API resources.

#### Acceptance Criteria

1. WHEN a login request is received with valid `email` and `password` credentials, THE API SHALL return a JWT and the authenticated user's profile.
2. IF a login request is received with an incorrect email or password, THEN THE API SHALL return a 401 error with a message that does not distinguish between wrong email and wrong password.
3. WHEN a valid JWT is presented in the `Authorization: Bearer` header, THE API SHALL authenticate the request and expose the user's identity and role to the request context.
4. IF an expired or invalid JWT is presented, THEN THE API SHALL return a 401 error.
5. WHEN a password reset request is received for a registered email address, THE API SHALL send a password reset email to that address.
6. IF a password reset request is received for an unregistered email address, THEN THE API SHALL return a 200 response without revealing whether the email exists.

---

### Requirement 3: Member Profile Management

**User Story:** As a Member, I want to view and update my profile, so that I can keep my information current.

#### Acceptance Criteria

1. WHEN an authenticated Member requests their own profile, THE API SHALL return the full Member record including `libraryNumber`, `membershipStatus`, `isApproved`, `photoURL`, and all registration fields.
2. WHEN an authenticated Member submits a photo update request with a valid image file not exceeding 5 MB, THE API SHALL replace the stored profile photo and return the new `photoURL`.
3. IF an authenticated Member submits a photo update request with a file exceeding 5 MB or of a non-image type, THEN THE API SHALL return a 422 error without modifying the stored photo.
4. THE API SHALL prevent Members from modifying `role`, `isApproved`, `membershipStatus`, `libraryNumber`, `email`, or `uid` through the profile update endpoint.
5. WHILE a Member is authenticated, THE API SHALL allow the Member to update only the fields: `photoURL` and `starredBookIds`.

---

### Requirement 4: Book Catalogue

**User Story:** As a visitor or Member, I want to browse the book catalogue, so that I can find books to borrow.

#### Acceptance Criteria

1. THE API SHALL expose a public endpoint that returns all Book records ordered by title.
2. THE Book record returned SHALL include: `id`, `title`, `author`, `category`, `quantity`, `available`, `barcode`, `coverUrl`, `description`, `createdAt`, and `updatedAt`.
3. WHEN an authenticated Librarian submits a book creation request with `title`, `quantity` (integer between 1 and 400), and optional `author`, `category`, `description`, and `coverFile`, THE API SHALL create a Book record and generate one Book_Copy record per copy with a unique barcode in the format `AMG-COPY-XXXXXXXXXXXXXXXXXX`.
4. IF a book creation request is received with a `quantity` outside the range 1–400 or without a `title`, THEN THE API SHALL return a 422 error.
5. WHERE a `coverFile` is included in the book creation request, THE API SHALL store the image and set `coverUrl` on the Book record.
6. WHEN an authenticated Librarian requests deletion of a Book, THE API SHALL delete the Book record and its associated cover image only IF the number of `available` copies equals the total `quantity`; otherwise THE API SHALL return a 409 error indicating active loans prevent deletion.
7. THE API SHALL accept `category` values only from the set: `PP / Pre-Primary`, `Primary`, `Junior Secondary`, `Senior Secondary`, `High School`, `University`, `General / Fiction`, `Other`.

---

### Requirement 5: Book_Copy and Barcode Management

**User Story:** As a Librarian, I want each physical book copy to have a unique barcode, so that I can scan it for issue and return operations.

#### Acceptance Criteria

1. WHEN a Book is created, THE API SHALL atomically create one Book_Copy record per requested copy, each with a unique `barcode` and `status` set to `"Available"`.
2. THE API SHALL ensure Book_Copy barcodes are globally unique across all copies in the system.
3. WHEN an authenticated Librarian requests the list of copies for a Book, THE API SHALL return all Book_Copy records for that Book including `copyNumber`, `barcode`, and `status`.

---

### Requirement 6: Borrow Requests

**User Story:** As an approved Member, I want to request a book, so that the librarian can issue it to me.

#### Acceptance Criteria

1. WHEN an authenticated approved Member submits a borrow request for a `bookId` where `available` > 0, THE API SHALL create a Borrow_Request with `status` set to `"Pending"` and return a 201 response.
2. IF an authenticated Member submits a borrow request and the Member's `isApproved` is `false`, THEN THE API SHALL return a 403 error.
3. IF an authenticated Member submits a borrow request for a Book where `available` is 0, THEN THE API SHALL return a 409 error.
4. IF an authenticated Member submits a borrow request for a Book for which they already have a `"Pending"` Borrow_Request, THEN THE API SHALL return a 409 error.
5. WHEN an authenticated Member requests their own Borrow_Requests, THE API SHALL return only Borrow_Request records belonging to that Member.
6. WHEN an authenticated Librarian approves a Borrow_Request, THE API SHALL atomically create a Loan record with `status` `"Borrowed"`, set `dueAt` to 14 days from the current date, and decrement `available` on the Book by 1, and set the Borrow_Request `status` to `"Approved"`.
7. IF a Librarian approves a Borrow_Request but `available` has dropped to 0 since the request was submitted, THEN THE API SHALL return a 409 error and leave all records unchanged.
8. WHEN an authenticated Librarian declines a Borrow_Request, THE API SHALL set the Borrow_Request `status` to `"Declined"` without modifying Book availability.
9. WHEN an authenticated Librarian requests all Borrow_Requests, THE API SHALL return all records ordered by `createdAt` descending.

---

### Requirement 7: Loan Management and Book Return

**User Story:** As a Librarian, I want to record book returns, so that availability is kept accurate.

#### Acceptance Criteria

1. WHEN an authenticated Librarian submits a return for a Loan by `loanId` where `status` is `"Borrowed"`, THE API SHALL atomically set Loan `status` to `"Returned"`, record `returnedAt`, increment `available` on the Book by 1, and return a 200 response.
2. IF an authenticated Librarian submits a return for a Loan where `status` is not `"Borrowed"`, THEN THE API SHALL return a 409 error.
3. WHEN an authenticated Librarian requests all Loans, THE API SHALL return all Loan records ordered by `createdAt` descending.
4. WHEN an authenticated Member requests their own Loans, THE API SHALL return only Loan records belonging to that Member.

---

### Requirement 8: Barcode Scanning — Issue and Return

**User Story:** As a Librarian, I want to scan a member barcode and a book copy barcode to issue or return a copy, so that physical circulation is tracked at the copy level.

#### Acceptance Criteria

1. WHEN an authenticated Librarian submits an issue request with a valid `libraryNumber` and `copyBarcode`, THE API SHALL atomically set the Book_Copy `status` to `"Borrowed"`, decrement the parent Book `available` by 1, create a Loan record linking the Member and Book_Copy, set `dueAt` to 14 days from issue, and return a success message.
2. IF the Book_Copy identified by `copyBarcode` has `status` not equal to `"Available"`, THEN THE API SHALL return a 409 error without modifying any record.
3. IF no Member exists with the given `libraryNumber`, THEN THE API SHALL return a 404 error.
4. IF the Member identified by `libraryNumber` has `isApproved` set to `false`, THEN THE API SHALL return a 403 error.
5. WHEN an authenticated Librarian submits a return request with a valid `copyBarcode`, THE API SHALL atomically set the Book_Copy `status` to `"Available"`, increment the parent Book `available` by 1, set the active Loan `status` to `"Returned"`, record `returnedAt`, and return a success message.
6. IF no active Loan exists for the Book_Copy identified by `copyBarcode`, THEN THE API SHALL return a 404 error.

---

### Requirement 9: Attendance Tracking

**User Story:** As a Librarian, I want to record member check-ins and check-outs, so that library occupancy is monitored.

#### Acceptance Criteria

1. WHEN an authenticated Librarian submits a check-in request with a valid `libraryNumber`, THE API SHALL atomically create an Attendance_Record with `status` `"In library"`, `checkInAt` set to the current timestamp, `checkOutAt` set to null, and update the Member Presence record to `"In library"`.
2. IF the Member identified by `libraryNumber` already has Presence `status` `"In library"`, THEN THE API SHALL return a 409 error without creating a duplicate Attendance_Record.
3. IF the current number of Members with Presence `"In library"` is greater than or equal to the configured Capacity, THEN THE API SHALL return a 409 error and refuse the check-in.
4. WHEN an authenticated Librarian submits a check-out request with a valid `libraryNumber`, THE API SHALL atomically update the active Attendance_Record `status` to `"Checked out"`, set `checkOutAt` to the current timestamp, and update the Member Presence record to `"Checked out"`.
5. IF the Member identified by `libraryNumber` has no Presence record with `status` `"In library"`, THEN THE API SHALL return a 409 error.
6. WHEN an authenticated Librarian requests the attendance list, THE API SHALL return all Attendance_Records ordered by `checkInAt` descending, up to a configurable limit.
7. THE API SHALL maintain a Presence record per Member that reflects the Member's current in-library status independently of the historical Attendance_Records.

---

### Requirement 10: Membership Approval

**User Story:** As a Librarian, I want to approve or deny membership applications, so that only vetted learners can borrow books.

#### Acceptance Criteria

1. WHEN an authenticated Librarian submits an approval decision of `"Approved"` for a Member with `membershipStatus` `"Pending"`, THE API SHALL set `isApproved` to `true`, `membershipStatus` to `"Approved"`, and record `approvedAt` and `decisionBy`.
2. WHEN an authenticated Librarian submits an approval decision of `"Denied"` for a Member with `membershipStatus` `"Pending"`, THE API SHALL set `isApproved` to `false`, `membershipStatus` to `"Denied"`, and record `deniedAt` and `decisionBy`.
3. IF an authenticated Librarian submits a membership decision for a Member whose `membershipStatus` is not `"Pending"`, THEN THE API SHALL return a 409 error.
4. WHEN an authenticated Librarian requests the list of all Members, THE API SHALL return all Member records ordered by `createdAt` descending.
5. WHEN an authenticated Librarian requests the list of pending Members, THE API SHALL return only Member records where `isApproved` is `false` and `membershipStatus` is `"Pending"`.

---

### Requirement 11: E-book Management

**User Story:** As a Librarian, I want to upload and manage e-books, so that approved Members can access digital reading material.

#### Acceptance Criteria

1. WHEN an authenticated Librarian uploads an e-book file of type PDF or EPUB not exceeding 30 MB with a `title` and `category`, THE API SHALL store the file, create an E-book record with `storagePath`, `fileName`, `size`, `title`, `category`, and `uploadedBy`, and return a 201 response.
2. IF an e-book upload request contains a file exceeding 30 MB, THEN THE API SHALL return a 422 error without storing any file.
3. IF an e-book upload request contains a file that is neither PDF nor EPUB, THEN THE API SHALL return a 422 error.
4. THE API SHALL expose a public endpoint that returns all E-book catalogue records (metadata only, no file URLs) ordered by `createdAt` descending.
5. WHEN an authenticated Member requests a download URL for a specific E-book, THE API SHALL return a time-limited, signed URL for the stored file.
6. IF an unauthenticated request attempts to obtain a download URL for an E-book file, THEN THE API SHALL return a 401 error.
7. WHEN an authenticated Librarian deletes an E-book, THE API SHALL delete the E-book record and the stored file.

---

### Requirement 12: News and Events

**User Story:** As a Librarian, I want to publish announcements and events, so that members and visitors are informed.

#### Acceptance Criteria

1. WHEN an authenticated Librarian submits a publish request with `type` `"announcement"` or `"event"`, a `title`, and a `body`, THE API SHALL create the post record with `createdAt`, `createdBy`, and optional `date`, and return a 201 response.
2. THE API SHALL expose a public endpoint that returns Announcements and Events combined, ordered by `date` (falling back to `createdAt`) descending, limited to the 20 most recent items per type.
3. WHEN an authenticated Librarian deletes a post by `id` and `type`, THE API SHALL delete the post record and return a 200 response.
4. IF a publish request is received without a `title` or `body`, THEN THE API SHALL return a 422 error.
5. THE API SHALL include a `announcementKind` field (`"Announcement"` or `"Event"`) and a `source` field (`"announcements"` or `"events"`) in each post record returned by the public feed endpoint, to maintain compatibility with the existing frontend.

---

### Requirement 13: Library Settings

**User Story:** As a Librarian, I want to configure the library capacity, so that safe occupancy limits are enforced.

#### Acceptance Criteria

1. WHEN an authenticated Librarian submits a settings update with a `capacity` value that is an integer between 1 and 10,000, THE API SHALL persist the value and return the updated settings.
2. IF a settings update request is received with a `capacity` outside the range 1–10,000 or non-integer, THEN THE API SHALL return a 422 error.
3. THE API SHALL expose a public endpoint that returns the current library settings including `capacity`.
4. WHILE no settings record exists, THE API SHALL default `capacity` to 100.

---

### Requirement 14: Authorization and Role Enforcement

**User Story:** As the system owner, I want all sensitive operations protected by role checks, so that members cannot perform librarian actions and unauthenticated users cannot access protected data.

#### Acceptance Criteria

1. THE API SHALL define two roles: `librarian` and `learner`, and enforce role-based access on every protected endpoint.
2. IF a request carrying a `learner` JWT attempts to access any Librarian-only endpoint, THEN THE API SHALL return a 403 error.
3. IF an unauthenticated request attempts to access any Member-only or Librarian-only endpoint, THEN THE API SHALL return a 401 error.
4. THE API SHALL expose these endpoints without authentication: book catalogue, e-book catalogue (metadata), news/events feed, and library settings.
5. THE API SHALL never expose a Member's `guardianPhone`, `guardianName`, or `guardianRelation` in public or cross-member responses; those fields SHALL only be returned to the owning Member or a Librarian.

---

### Requirement 15: File Storage

**User Story:** As a developer, I want all uploaded files managed consistently, so that URLs are stable and access is controlled.

#### Acceptance Criteria

1. THE API SHALL store member profile photos, book cover images, and e-book files in separate storage paths.
2. WHEN a file is deleted (member photo replacement, book deletion, e-book deletion), THE API SHALL also delete the associated stored file.
3. THE API SHALL validate file MIME type and size before storing any uploaded file.
4. WHEN an e-book download URL is generated, THE API SHALL issue a signed URL that expires after no more than 60 minutes.
5. THE API SHALL accept cover images in JPEG, PNG, and WebP formats for both member photos and book covers.

---

### Requirement 16: Statistics and Dashboard Data

**User Story:** As a Librarian, I want a statistics summary endpoint, so that I can see library usage at a glance.

#### Acceptance Criteria

1. WHEN an authenticated Librarian requests the statistics summary, THE API SHALL return: total Members count, pending approval count, total Book titles count, total Book_Copy count, currently active Loans count, today's check-in count, and total available copies.
2. THE statistics endpoint SHALL compute all figures from live data at request time.

---

### Requirement 17: API Consistency and Error Handling

**User Story:** As a frontend developer, I want predictable JSON responses and HTTP status codes, so that I can handle API responses consistently.

#### Acceptance Criteria

1. THE API SHALL return all responses as JSON with a `Content-Type: application/json` header.
2. THE API SHALL use HTTP status codes consistently: 200 for success, 201 for resource creation, 400 for malformed requests, 401 for unauthenticated, 403 for unauthorized, 404 for not found, 409 for conflict, and 422 for validation errors.
3. WHEN a validation error occurs, THE API SHALL return a 422 response body containing a `message` string and an `errors` object mapping field names to arrays of error strings.
4. WHEN an unexpected server error occurs, THE API SHALL return a 500 response with a generic message and SHALL log the full error internally without exposing stack traces to the client.
5. THE API SHALL include CORS headers permitting requests from the frontend origin (Vercel deployment URL) on all endpoints.
6. THE API SHALL support pagination on list endpoints for Members, Books, Loans, Borrow_Requests, and Attendance_Records using `page` and `per_page` query parameters.
