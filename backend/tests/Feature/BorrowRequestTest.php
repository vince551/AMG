<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BorrowRequest;
use App\Models\Loan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BorrowRequestTest extends TestCase
{
    use RefreshDatabase;

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function librarianToken(): string
    {
        $librarian = User::factory()->create(['role' => 'librarian']);
        return auth('api')->login($librarian);
    }

    private function approvedLearnerToken(): array
    {
        $user = User::factory()->create(['role' => 'learner', 'is_approved' => true]);
        return ['user' => $user, 'token' => auth('api')->login($user)];
    }

    // ── POST /borrow-requests ─────────────────────────────────────────────────

    public function test_approved_member_can_create_borrow_request(): void
    {
        ['user' => $user, 'token' => $token] = $this->approvedLearnerToken();
        $book = Book::factory()->create(['available' => 3]);

        $response = $this->withToken($token)->postJson('/api/v1/borrow-requests', [
            'bookId' => $book->id,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('borrow_requests', [
            'user_id' => $user->uid,
            'book_id' => $book->id,
            'status'  => 'Pending',
        ]);
    }

    public function test_unapproved_member_cannot_borrow(): void
    {
        $user  = User::factory()->create(['role' => 'learner', 'is_approved' => false]);
        $token = auth('api')->login($user);
        $book  = Book::factory()->create(['available' => 2]);

        $this->withToken($token)->postJson('/api/v1/borrow-requests', [
            'bookId' => $book->id,
        ])->assertStatus(403);
    }

    public function test_borrow_request_fails_when_no_copies_available(): void
    {
        ['token' => $token] = $this->approvedLearnerToken();
        $book = Book::factory()->create(['available' => 0]);

        $this->withToken($token)->postJson('/api/v1/borrow-requests', [
            'bookId' => $book->id,
        ])->assertStatus(409);
    }

    public function test_duplicate_pending_borrow_request_is_rejected(): void
    {
        ['user' => $user, 'token' => $token] = $this->approvedLearnerToken();
        $book = Book::factory()->create(['available' => 5]);

        // Create an existing Pending request for the same user + book
        BorrowRequest::factory()->create([
            'user_id' => $user->uid,
            'book_id' => $book->id,
            'status'  => 'Pending',
        ]);

        $this->withToken($token)->postJson('/api/v1/borrow-requests', [
            'bookId' => $book->id,
        ])->assertStatus(409);
    }

    public function test_unauthenticated_cannot_create_borrow_request(): void
    {
        $book = Book::factory()->create(['available' => 2]);

        $this->postJson('/api/v1/borrow-requests', [
            'bookId' => $book->id,
        ])->assertStatus(401);
    }

    // ── POST /borrow-requests/{id}/approve ────────────────────────────────────

    public function test_librarian_can_approve_borrow_request(): void
    {
        $token   = $this->librarianToken();
        $book    = Book::factory()->create(['available' => 3, 'quantity' => 3]);
        $request = BorrowRequest::factory()->create([
            'book_id' => $book->id,
            'status'  => 'Pending',
        ]);

        $response = $this->withToken($token)->postJson("/api/v1/borrow-requests/{$request->id}/approve");

        $response->assertStatus(200);

        // Loan was created
        $this->assertDatabaseHas('loans', [
            'user_id' => $request->user_id,
            'book_id' => $book->id,
            'status'  => 'Borrowed',
        ]);

        // Book availability decremented
        $this->assertEquals(2, $book->fresh()->available);

        // Request status updated
        $this->assertEquals('Approved', $request->fresh()->status);
        $this->assertNotNull($request->fresh()->loan_id);
    }

    public function test_approve_returns_409_when_no_copies_available(): void
    {
        $token   = $this->librarianToken();
        $book    = Book::factory()->create(['available' => 0, 'quantity' => 3]);
        $request = BorrowRequest::factory()->create([
            'book_id' => $book->id,
            'status'  => 'Pending',
        ]);

        $this->withToken($token)->postJson("/api/v1/borrow-requests/{$request->id}/approve")
            ->assertStatus(409);
    }

    // ── POST /borrow-requests/{id}/decline ────────────────────────────────────

    public function test_librarian_can_decline_borrow_request(): void
    {
        $token   = $this->librarianToken();
        $book    = Book::factory()->create(['available' => 3]);
        $request = BorrowRequest::factory()->create([
            'book_id' => $book->id,
            'status'  => 'Pending',
        ]);
        $availableBefore = $book->available;

        $response = $this->withToken($token)->postJson("/api/v1/borrow-requests/{$request->id}/decline");

        $response->assertStatus(200);

        // Status updated to Declined
        $this->assertEquals('Declined', $request->fresh()->status);

        // Availability unchanged
        $this->assertEquals($availableBefore, $book->fresh()->available);
    }

    // ── GET /my/requests ─────────────────────────────────────────────────────

    public function test_member_can_view_own_requests(): void
    {
        ['user' => $user, 'token' => $token] = $this->approvedLearnerToken();
        $otherUser = User::factory()->create(['role' => 'learner', 'is_approved' => true]);

        // Create 2 requests for our user and 1 for another user
        BorrowRequest::factory()->count(2)->create(['user_id' => $user->uid]);
        BorrowRequest::factory()->create(['user_id' => $otherUser->uid]);

        $response = $this->withToken($token)->getJson('/api/v1/my/requests');

        $response->assertStatus(200);

        // Only the 2 belonging to this user are returned
        $this->assertCount(2, $response->json('data'));
        foreach ($response->json('data') as $item) {
            $this->assertEquals($user->uid, $item['user_id']);
        }
    }

    public function test_my_requests_pagination(): void
    {
        ['user' => $user, 'token' => $token] = $this->approvedLearnerToken();

        BorrowRequest::factory()->count(5)->create(['user_id' => $user->uid]);

        $response = $this->withToken($token)->getJson('/api/v1/my/requests?page=1&per_page=2');

        $response->assertStatus(200)
            ->assertJsonStructure(['data', 'current_page', 'per_page', 'total', 'last_page']);

        $this->assertCount(2, $response->json('data'));
        $this->assertEquals(5, $response->json('total'));
    }

    // ── GET /borrow-requests (librarian) ──────────────────────────────────────

    public function test_librarian_can_list_all_borrow_requests(): void
    {
        $token = $this->librarianToken();

        // Create 3 requests with different timestamps to verify ordering
        $r1 = BorrowRequest::factory()->create(['created_at' => now()->subMinutes(2)]);
        $r2 = BorrowRequest::factory()->create(['created_at' => now()->subMinute()]);
        $r3 = BorrowRequest::factory()->create(['created_at' => now()]);

        $response = $this->withToken($token)->getJson('/api/v1/borrow-requests');

        $response->assertStatus(200);

        $ids = collect($response->json('data'))->pluck('id')->values()->toArray();

        // Most recent first
        $this->assertEquals([$r3->id, $r2->id, $r1->id], $ids);
    }

    public function test_borrow_requests_index_returns_pagination_metadata(): void
    {
        $token = $this->librarianToken();

        BorrowRequest::factory()->count(5)->create();

        $response = $this->withToken($token)->getJson('/api/v1/borrow-requests?per_page=2');

        $response->assertStatus(200)
            ->assertJsonStructure(['data', 'current_page', 'per_page', 'total', 'last_page']);

        $this->assertCount(2, $response->json('data'));
        $this->assertEquals(5, $response->json('total'));
    }

    public function test_learner_cannot_access_borrow_requests_index(): void
    {
        $learner = User::factory()->create(['role' => 'learner']);
        $token   = auth('api')->login($learner);

        $this->withToken($token)->getJson('/api/v1/borrow-requests')
            ->assertStatus(403);
    }

    // ── Business logic ────────────────────────────────────────────────────────

    public function test_due_at_is_14_days_from_borrowed_at(): void
    {
        $token   = $this->librarianToken();
        $book    = Book::factory()->create(['available' => 2, 'quantity' => 2]);
        $request = BorrowRequest::factory()->create([
            'book_id' => $book->id,
            'status'  => 'Pending',
        ]);

        $response = $this->withToken($token)->postJson("/api/v1/borrow-requests/{$request->id}/approve");

        $response->assertStatus(200);

        $loan = Loan::find($response->json('loan.id'));
        $this->assertNotNull($loan);

        $this->assertEquals(
            $loan->borrowed_at->copy()->addDays(14)->toDateString(),
            $loan->due_at->toDateString()
        );
    }
}
