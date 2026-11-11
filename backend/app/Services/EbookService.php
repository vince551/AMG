<?php

namespace App\Services;

use App\Models\Ebook;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class EbookService
{
    private const MAX_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB

    private const ALLOWED_MIMES = ['application/pdf', 'application/epub+zip'];

    public function upload(array $data, UploadedFile $file, string $uploaderUid): Ebook
    {
        if ($file->getSize() > self::MAX_SIZE_BYTES) {
            throw ValidationException::withMessages(['file' => ['E-book must not exceed 30 MB.']]);
        }

        $mime = $file->getMimeType() ?? '';
        if (! in_array($mime, self::ALLOWED_MIMES, true)) {
            throw ValidationException::withMessages(['file' => ['Only PDF and EPUB files are allowed.']]);
        }

        $path = $file->store('ebooks', 'local');
        if (! $path) {
            throw new \RuntimeException('E-book could not be stored.');
        }

        try {
            $ebook = Ebook::create([
                'title' => $data['title'],
                'category' => $data['category'] ?? null,
                'file_name' => $file->getClientOriginalName(),
                'storage_path' => $path,
                'size' => $file->getSize(),
                'uploaded_by' => $uploaderUid,
            ]);
            ActivityService::record('ebook.created', 'ebook', $ebook->id, [], $uploaderUid);

            return $ebook;
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);
            throw $e;
        }
    }

    public function signedDownloadUrl(Ebook $ebook): string
    {
        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('local');

        // For local disk, generate a temporary signed URL via Laravel's built-in support
        return $disk->temporaryUrl(
            $ebook->storage_path,
            now()->addMinutes(60)
        );
    }

    public function update(Ebook $ebook, array $data, ?UploadedFile $file = null): Ebook
    {
        if ($file && (! in_array($file->getMimeType(), self::ALLOWED_MIMES, true) || $file->getSize() > self::MAX_SIZE_BYTES)) {
            throw ValidationException::withMessages(['file' => ['Choose a PDF or EPUB up to 30 MB.']]);
        }
        $path = $file?->store('ebooks', 'local');
        if ($file && ! $path) {
            throw new \RuntimeException('E-book could not be stored.');
        }
        $old = null;
        try {
            $result = LibraryTransaction::run(function () use ($ebook, $data, $file, $path, &$old) {
                $ebook->refresh();
                $fields = array_intersect_key($data, array_flip(['title', 'category']));
                if ($path) {
                    $old = $ebook->storage_path;
                    $fields += ['storage_path' => $path, 'file_name' => $file->getClientOriginalName(), 'size' => $file->getSize()];
                }
                $ebook->update($fields);
                ActivityService::record('ebook.updated', 'ebook', $ebook->id);

                return $ebook;
            });
        } catch (\Throwable $error) {
            if ($path) {
                Storage::disk('local')->delete($path);
            }
            throw $error;
        }
        if ($old) {
            Storage::disk('local')->delete($old);
        }

        return $result;
    }

    public function delete(Ebook $ebook): void
    {
        LibraryTransaction::run(function () use ($ebook) {
            $ebook->delete();
            ActivityService::record('ebook.deleted', 'ebook', $ebook->id);
        });

        try {
            Storage::disk('local')->delete($ebook->storage_path);
        } catch (\Throwable $e) {
            Log::error('Failed to delete ebook file', [
                'path' => $ebook->storage_path,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
