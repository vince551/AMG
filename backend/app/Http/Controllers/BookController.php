<?php

namespace App\Http\Controllers;

use App\Services\BookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class BookController extends Controller
{
    public function __construct(private BookService $bookService) {}

    /** GET /books — public catalogue */
    public function index(Request $request): JsonResponse
    {
        $books = \App\Models\Book::orderBy('title')
            ->paginate($request->integer('per_page', 15));

        return response()->json($books);
    }

    /** POST /books — librarian creates a book */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'       => ['required', 'string', 'max:160'],
            'author'      => ['sometimes', 'nullable', 'string', 'max:120'],
            'category'    => ['sometimes', 'nullable', Rule::in([
                'PP / Pre-Primary', 'Primary', 'Junior Secondary',
                'Senior Secondary', 'High School', 'University',
                'General / Fiction', 'Other',
            ])],
            'quantity'    => ['required', 'integer', 'min:1', 'max:400'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'coverFile'   => ['sometimes', 'nullable', 'file', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
        ]);

        $cover = $request->hasFile('coverFile') ? $request->file('coverFile') : null;
        $book  = $this->bookService->createBook($data, $cover);

        return response()->json($book->load('copies'), 201);
    }

    /** DELETE /books/{id} — librarian deletes a book */
    public function destroy(int $id): JsonResponse
    {
        $book = \App\Models\Book::findOrFail($id);
        $this->bookService->deleteBook($book);

        return response()->json(['message' => 'Book deleted.']);
    }

    /** GET /books/{id}/copies — librarian lists copies */
    public function copies(int $id): JsonResponse
    {
        $book   = \App\Models\Book::findOrFail($id);
        $copies = $book->copies()->get(['id', 'copy_number', 'barcode', 'status']);

        return response()->json($copies);
    }
}
