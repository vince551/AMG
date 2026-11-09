<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\Book;
use App\Models\BookCopy;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BookService
{
    public function createBook(array $data, ?UploadedFile $cover = null): Book
    {
        return DB::transaction(function () use ($data, $cover) {
            $coverUrl  = null;
            $coverPath = null;

            if ($cover !== null) {
                $coverPath = $cover->store('covers', 'public');
                $coverUrl  = Storage::disk('public')->url($coverPath);
            }

            $book = Book::create([
                'title'              => $data['title'],
                'author'             => $data['author'] ?? null,
                'category'           => $data['category'] ?? null,
                'quantity'           => $data['quantity'],
                'available'          => $data['quantity'],
                'cover_url'          => $coverUrl,
                'cover_storage_path' => $coverPath,
                'description'        => $data['description'] ?? null,
            ]);

            for ($i = 1; $i <= $data['quantity']; $i++) {
                BookCopy::create([
                    'book_id'     => $book->id,
                    'copy_number' => $i,
                    'barcode'     => $this->generateBarcode(),
                    'status'      => 'Available',
                ]);
            }

            return $book;
        });
    }

    public function deleteBook(Book $book): void
    {
        if ($book->available !== $book->quantity) {
            throw new ConflictException('Cannot delete book: some copies are currently on loan.');
        }

        DB::transaction(function () use ($book) {
            if ($book->cover_storage_path) {
                Storage::disk('public')->delete($book->cover_storage_path);
            }
            $book->copies()->delete();
            $book->delete();
        });
    }

    private function generateBarcode(): string
    {
        do {
            $barcode = 'AMG-COPY-'.strtoupper(Str::random(18));
        } while (BookCopy::where('barcode', $barcode)->exists());

        return $barcode;
    }
}
