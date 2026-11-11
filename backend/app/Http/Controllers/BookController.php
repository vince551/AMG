<?php

namespace App\Http\Controllers;

use App\Models\Book;
use App\Models\BookCopy;
use App\Services\BookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BookController extends Controller
{
    public function __construct(private BookService $bookService) {}

    /** GET /books — public catalogue */
    public function index(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $request->validate(['archived' => ['sometimes', 'boolean'], 'availability' => ['sometimes', Rule::in(['available', 'unavailable'])]]);
        $query = Book::query();
        if ($request->is('api/v1/inventory/*') && $request->boolean('archived')) {
            $query->whereNotNull('archived_at');
        } else {
            $query->whereNull('archived_at');
        }
        if ($request->is('api/v1/my/saved-books')) {
            $query->whereIn('id', $request->user()->starred_book_ids ?? []);
        }
        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }
        if ($request->input('availability') === 'available') {
            $query->where('available', '>', 0);
        }
        if ($request->input('availability') === 'unavailable') {
            $query->where('available', 0);
        }
        $this->search($query, $request, ['title', 'author']);

        return response()->json($query->orderBy('title')->orderBy('id')->paginate($size));
    }

    /** POST /books — librarian creates a book */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'author' => ['sometimes', 'nullable', 'string', 'max:120'],
            'category' => ['sometimes', 'nullable', Rule::in([
                'PP / Pre-Primary', 'Primary', 'Junior Secondary',
                'Senior Secondary', 'High School', 'University',
                'General / Fiction', 'Other',
            ])],
            'quantity' => ['required', 'integer', 'min:1', 'max:400'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'coverFile' => ['sometimes', 'nullable', 'file', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
        ]);

        $cover = $request->hasFile('coverFile') ? $request->file('coverFile') : null;
        $book = $this->bookService->createBook($data, $cover);

        return response()->json($book->load('copies'), 201);
    }

    /** DELETE /books/{id} — librarian deletes a book */
    public function destroy(int $id): JsonResponse
    {
        $book = Book::findOrFail($id);
        $this->bookService->deleteBook($book);

        return response()->json(['message' => 'Book archived. History has been preserved.']);
    }

    /** GET /books/{id}/copies — librarian lists copies */
    public function copies(Request $request, int $id): JsonResponse
    {
        $size = $this->perPage($request);
        $book = Book::findOrFail($id);
        $query = $book->copies()->orderBy('copy_number');
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return response()->json($query->paginate($size));
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:160'],
            'author' => ['sometimes', 'nullable', 'string', 'max:120'],
            'category' => ['sometimes', 'nullable', 'string', 'max:60'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'coverFile' => ['sometimes', 'nullable', 'file', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
            'removeCover' => ['sometimes', 'boolean'],
        ]);

        return response()->json($this->bookService->updateBook(Book::findOrFail($id), $data, $request->file('coverFile')));
    }

    public function restore(int $id): JsonResponse
    {
        return response()->json($this->bookService->setArchived(Book::findOrFail($id), false));
    }

    public function addCopies(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['quantity' => ['required', 'integer', 'min:1', 'max:400']]);

        return response()->json($this->bookService->addCopies(Book::findOrFail($id), $data['quantity']), 201);
    }

    public function updateCopy(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(['Available', 'Damaged', 'Lost', 'Withdrawn'])]]);

        return response()->json($this->bookService->changeCopyStatus(BookCopy::findOrFail($id), $data['status']));
    }
}
