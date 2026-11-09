<?php

namespace App\Services;

use App\Models\Ebook;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class EbookService
{
    private const MAX_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB
    private const ALLOWED_MIMES  = ['application/pdf', 'application/epub+zip'];

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

        try {
            return Ebook::create([
                'title'        => $data['title'],
                'category'     => $data['category'] ?? null,
                'file_name'    => $file->getClientOriginalName(),
                'storage_path' => $path,
                'size'         => $file->getSize(),
                'uploaded_by'  => $uploaderUid,
            ]);
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);
            throw $e;
        }
    }

    public function signedDownloadUrl(Ebook $ebook): string
    {
        // For local disk, generate a temporary signed URL via Laravel's built-in support
        return Storage::disk('local')->temporaryUrl(
            $ebook->storage_path,
            now()->addMinutes(60)
        );
    }

    public function delete(Ebook $ebook): void
    {
        $ebook->delete();

        try {
            Storage::disk('local')->delete($ebook->storage_path);
        } catch (\Throwable $e) {
            Log::error('Failed to delete ebook file', [
                'path'  => $ebook->storage_path,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
