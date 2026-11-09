<?php

namespace Tests\Feature;

use App\Models\Book;
use App\Models\BookCopy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BookTest extends TestCase
{
    use RefreshDatabase;

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function librarianToken(): string
    {
        $librarian = User::factory()->create(['role' => 'librarian']);
        return auth('api')->login($librarian);
    }

    // ── GET /books (public) ──────────────────────────────────────────────────

    public function test_books_index_is_publicly_accessible(): void
    {
        $response = $this->getJson('/api/v1/books');
        $response->assertStatus(200);
    }

    public function test_books_index_returns_books_ordered_by_title(): void
    {
        Book::factory()->create(['title' => 'Zebra Stories']);
        Book::factory()->create(['title' => 'Apple Tales']);
        Book::factory()->create(['title' => 'Mango Days']);

        $titles = collect($this->getJson('/api/v1/books')->json('data'))
            ->pluck('title')->values()->toArray();

        $this->assertEquals(['Apple Tales', 'Mango Days', 'Zebra Stories'], $titles);
    }

    public function test_books_index_returns_pagination_metadata(): void
    {
        Book::factory()->count(5)->create();

        $response = $this->getJson('/api/v1/books?page=1&per_page=2');
        $response->assertStatus(200)
            ->assertJsonStructure(['data', 'current_page', 'per_page', 'total', 'last_page']);

        $this->assertCount(2, $response->json('data'));
        $this->assertEquals(5, $response->json('total'));
    }

    public function test_books_index_returns_required_fields(): void
    {
        Book::factory()->create();

        $this->getJson('/api/v1/books')
            ->assertStatus(200)
            ->assertJsonStructure([
                'data' => [['id', 'title', 'author', 'category', 'quantity', 'available', 'cover_url', 'description', 'created_at', 'updated_at']],
            ]);
    }

    // ── POST /books ──────────────────────────────────────────────────────────

    public function test_librarian_can_create_book(): void
    {
        $token = $this->librarianToken();

        $this->withToken($token)->postJson('/api/v1/books', [
            'title'    => 'Test Book',
            'quantity' => 3,
            'category' => 'Primary',
        ])->assertStatus(201);

        $this->assertDatabaseHas('books', ['title' => 'Test Book', 'quantity' => 3, 'available' => 3]);
    }

    public function test_creating_book_generates_correct_copy_count(): void
    {
        $token = $this->librarianToken();

        $this->withToken($token)->postJson('/api/v1/books', [
            'title'    => 'Multi Copy Book',
            'quantity' => 5,
        ])->assertStatus(201);

        $book = Book::where('title', 'Multi Copy Book')->first();
        $this->assertCount(5, $book->copies);
    }

    public function test_copy_barcodes_match_required_format(): void
    {
        $token = $this->librarianToken();

        $this->withToken($token)->postJson('/api/v1/books', [
            'title'    => 'Barcode Book',
            'quantity' => 3,
        ])->assertStatus(201);

        Book::where('title', 'Barcode Book')->first()->copies->each(function ($copy) {
            $this->assertMatchesRegularExpression('/^AMG-COPY-[A-Z0-9]{18}$/', $copy->barcode);
        });
    }

    public function test_copy_barcodes_are_unique(): void
    {
        $token = $this->librarianToken();

        $this->withToken($token)->postJson('/api/v1/books', ['title' => 'Book A', 'quantity' => 10])
            ->assertStatus(201);

        $barcodes = BookCopy::pluck('barcode')->toArray();
        $this->assertCount(count($barcodes), array_unique($barcodes));
    }

    public function test_all_copies_are_created_with_available_status(): void
    {
        $token = $this->librarianToken();

        $this->withToken($token)->postJson('/api/v1/books', ['title' => 'Status Book', 'quantity' => 4])
            ->assertStatus(201);

        $statuses = Book::where('title', 'Status Book')->first()->copies->pluck('status')->unique()->toArray();
        $this->assertEquals(['Available'], $statuses);
    }

    public function test_creating_book_requires_title(): void
    {
        $token = $this->librarianToken();

        $this->withToken($token)->postJson('/api/v1/books', ['quantity' => 2])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['title']);
    }

    public function test_creating_book_requires_quantity_between_1_and_400(): void
    {
        $token = $this->librarianToken();

        $this->withToken($token)->postJson('/api/v1/books', ['title' => 'T', 'quantity' => 0])
            ->assertStatus(422)->assertJsonValidationErrors(['quantity']);

        $this->withToken($token)->postJson('/api/v1/books', ['title' => 'T', 'quantity' => 401])
            ->assertStatus(422)->assertJsonValidationErrors(['quantity']);
    }

    public function test_creating_book_rejects_invalid_category(): void
    {
        $token = $this->librarianToken();

        $this->withToken($token)->postJson('/api/v1/books', [
            'title'    => 'Cat Book',
            'quantity' => 1,
            'category' => 'InvalidCategory',
        ])->assertStatus(422)->assertJsonValidationErrors(['category']);
    }

    public function test_creating_book_stores_cover_image(): void
    {
        Storage::fake('public');
        $token = $this->librarianToken();

        $response = $this->withToken($token)->postJson('/api/v1/books', [
            'title'     => 'Cover Book',
            'quantity'  => 1,
            'coverFile' => UploadedFile::fake()->image('cover.jpg'),
        ]);

        $response->assertStatus(201);
        $this->assertNotNull($response->json('cover_url'));
    }

    public function test_unauthenticated_cannot_create_book(): void
    {
        $this->postJson('/api/v1/books', ['title' => 'Unauthorized', 'quantity' => 1])
            ->assertStatus(401);
    }

    public function test_learner_cannot_create_book(): void
    {
        $learner = User::factory()->create(['role' => 'learner']);
        $token   = auth('api')->login($learner);

        $this->withToken($token)->postJson('/api/v1/books', ['title' => 'Forbidden', 'quantity' => 1])
            ->assertStatus(403);
    }

    // ── DELETE /books/{id} ───────────────────────────────────────────────────

    public function test_librarian_can_delete_book_when_all_copies_available(): void
    {
        $token = $this->librarianToken();
        $book  = Book::factory()->create(['quantity' => 2, 'available' => 2]);

        $this->withToken($token)->deleteJson("/api/v1/books/{$book->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('books', ['id' => $book->id]);
    }

    public function test_delete_book_returns_409_when_copies_on_loan(): void
    {
        $token = $this->librarianToken();
        $book  = Book::factory()->create(['quantity' => 2, 'available' => 1]);

        $this->withToken($token)->deleteJson("/api/v1/books/{$book->id}")
            ->assertStatus(409);

        $this->assertDatabaseHas('books', ['id' => $book->id]);
    }

    public function test_delete_book_returns_404_for_nonexistent_book(): void
    {
        $token = $this->librarianToken();

        $this->withToken($token)->deleteJson('/api/v1/books/99999')
            ->assertStatus(404);
    }

    // ── GET /books/{id}/copies ───────────────────────────────────────────────

    public function test_librarian_can_list_copies_for_book(): void
    {
        $token = $this->librarianToken();
        $book  = Book::factory()->create();
        BookCopy::factory()->count(3)->create(['book_id' => $book->id]);

        $this->withToken($token)->getJson("/api/v1/books/{$book->id}/copies")
            ->assertStatus(200)
            ->assertJsonCount(3)
            ->assertJsonStructure([['id', 'copy_number', 'barcode', 'status']]);
    }

    public function test_learner_cannot_list_copies(): void
    {
        $learner = User::factory()->create(['role' => 'learner']);
        $token   = auth('api')->login($learner);
        $book    = Book::factory()->create();

        $this->withToken($token)->getJson("/api/v1/books/{$book->id}/copies")
            ->assertStatus(403);
    }

    public function test_copies_returns_404_for_nonexistent_book(): void
    {
        $token = $this->librarianToken();

        $this->withToken($token)->getJson('/api/v1/books/99999/copies')
            ->assertStatus(404);
    }
}
