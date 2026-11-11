<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\Book;
use App\Models\BookCopy;
use App\Models\Hold;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class BookService
{
    public function createBook(array $data, ?UploadedFile $cover = null): Book
    {
        $newPath = null;
        try {
            return LibraryTransaction::run(function () use ($data, $cover, &$newPath) {
                $coverUrl = null;
                $coverPath = null;

                if ($cover !== null) {
                    $coverPath = $cover->store('covers', 'public');
                    if (! $coverPath) {
                        throw new \RuntimeException('Cover could not be stored.');
                    }
                    $newPath = $coverPath;
                    $coverUrl = Storage::disk('public')->url($coverPath);
                }

                $book = Book::create([
                    'title' => $data['title'],
                    'author' => $data['author'] ?? null,
                    'category' => $data['category'] ?? null,
                    'quantity' => $data['quantity'],
                    'available' => $data['quantity'],
                    'cover_url' => $coverUrl,
                    'cover_storage_path' => $coverPath,
                    'description' => $data['description'] ?? null,
                ]);

                for ($i = 1; $i <= $data['quantity']; $i++) {
                    BookCopy::create([
                        'book_id' => $book->id,
                        'copy_number' => $i,
                        'barcode' => $this->generateBarcode(),
                        'status' => 'Available',
                    ]);
                }

                ActivityService::record('book.created', 'book', $book->id, ['count' => $data['quantity']]);

                return $book;
            });
        } catch (\Throwable $error) {
            if ($newPath) {
                Storage::disk('public')->delete($newPath);
            }
            throw $error;
        }
    }

    public function deleteBook(Book $book): void
    {
        $this->setArchived($book, true);
    }

    public function setArchived(Book $book, bool $archived): Book
    {
        return LibraryTransaction::run(function () use ($book, $archived) {
            $book->refresh();
            if ($archived && ($book->loans()->where('status', 'Borrowed')->exists() || Hold::where('book_id', $book->id)->whereIn('status', ['Waiting', 'Ready'])->exists())) {
                throw new ConflictException('Return active loans and resolve holds before archiving this title.');
            }
            if ($archived) {
                foreach ($book->borrowRequests()->where('status', 'Pending')->get() as $request) {
                    $request->update(['status' => 'Declined', 'reason' => 'This title was archived.', 'processed_at' => now(), 'processed_by' => auth()->user()?->uid]);
                    ActivityService::notify($request->user_id, 'Request declined', $book->title.' was archived.', 'requests');
                }
            }
            $book->update(['archived_at' => $archived ? now() : null]);
            ActivityService::record($archived ? 'book.archived' : 'book.restored', 'book', $book->id);

            return $book;
        });
    }

    public function updateBook(Book $book, array $data, ?UploadedFile $cover = null): Book
    {
        $newPath = $cover?->store('covers', 'public');
        if ($cover && ! $newPath) {
            throw new \RuntimeException('Cover could not be stored.');
        }
        $oldPath = null;
        try {
            $result = LibraryTransaction::run(function () use ($book, $data, $newPath, &$oldPath) {
                $book->refresh();
                $fields = array_intersect_key($data, array_flip(['title', 'author', 'category', 'description']));
                if ($newPath || ($data['removeCover'] ?? false)) {
                    $oldPath = $book->cover_storage_path;
                    $fields['cover_storage_path'] = $newPath ?: null;
                    $fields['cover_url'] = $newPath ? Storage::disk('public')->url($newPath) : null;
                }
                $book->update($fields);
                ActivityService::record('book.updated', 'book', $book->id, ['fields' => array_keys($fields)]);

                return $book->fresh();
            });
        } catch (\Throwable $error) {
            if ($newPath) {
                Storage::disk('public')->delete($newPath);
            }
            throw $error;
        }
        if ($oldPath) {
            Storage::disk('public')->delete($oldPath);
        }

        return $result;
    }

    public function addCopies(Book $book, int $count): Book
    {
        return LibraryTransaction::run(function () use ($book, $count) {
            $book->refresh();
            if ($book->archived_at) {
                throw new ConflictException('Restore this title before adding copies.');
            }
            $last = (int) $book->copies()->max('copy_number');
            if ($last + $count > 65535) {
                throw new ConflictException('This title has reached its copy-number limit.');
            }
            for ($number = $last + 1; $number <= $last + $count; $number++) {
                $book->copies()->create(['copy_number' => $number, 'barcode' => $this->generateBarcode(), 'status' => 'Available']);
            }
            $this->synchronize($book);
            app(HoldService::class)->reconcile($book);
            ActivityService::record('copies.added', 'book', $book->id, ['count' => $count]);

            return $book->fresh();
        });
    }

    public function changeCopyStatus(BookCopy $copy, string $status): BookCopy
    {
        return LibraryTransaction::run(function () use ($copy, $status) {
            $copy->refresh();
            if (in_array($copy->status, ['Borrowed', 'Reserved'], true)) {
                throw new ConflictException('Return the loan or release its hold before changing this copy.');
            }
            if ($copy->book->loans()->where('status', 'Borrowed')->whereNull('book_copy_id')->exists()) {
                throw new ConflictException('Reconcile unassigned loans before changing copy inventory.');
            }
            $copy->update(['status' => $status]);
            $this->synchronize($copy->book);
            app(HoldService::class)->reconcile($copy->book);
            ActivityService::record('copy.updated', 'copy', $copy->id, ['status' => $status]);

            return $copy->fresh();
        });
    }

    public function synchronize(Book $book): void
    {
        $legacy = $book->loans()->where('status', 'Borrowed')->whereNull('book_copy_id')->count();
        $book->update([
            'quantity' => $book->copies()->where('status', '!=', 'Withdrawn')->count(),
            'available' => max(0, $book->copies()->where('status', 'Available')->count() - $legacy),
        ]);
    }

    private function generateBarcode(): string
    {
        do {
            $barcode = 'AMG-COPY-'.strtoupper(Str::random(18));
        } while (BookCopy::where('barcode', $barcode)->exists());

        return $barcode;
    }
}
