<?php

namespace App\Http\Controllers;

use App\Models\Ebook;
use App\Services\EbookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EbookController extends Controller
{
    public function __construct(private EbookService $ebookService) {}

    /** GET /ebooks — public catalogue (no file URLs) */
    public function index(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $query = Ebook::query();
        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }
        $this->search($query, $request, ['title', 'category']);

        return response()->json($query->latest()->paginate($size));
    }

    /** POST /ebooks — librarian uploads */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:160'],
            'category' => ['sometimes', 'nullable', 'string', 'max:60'],
            'file' => ['required', 'file', 'mimes:pdf,epub', 'max:30720'],
        ]);

        $ebook = $this->ebookService->upload($data, $request->file('file'), Auth::user()->uid);

        return response()->json($ebook, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:160'],
            'category' => ['sometimes', 'nullable', 'string', 'max:60'],
            'file' => ['sometimes', 'nullable', 'file', 'mimes:pdf,epub', 'max:30720'],
        ]);

        return response()->json($this->ebookService->update(Ebook::findOrFail($id), $data, $request->file('file')));
    }

    /** GET /ebooks/{id}/download-url — authenticated member */
    public function downloadUrl(int $id): JsonResponse
    {
        $ebook = Ebook::findOrFail($id);
        $url = $this->ebookService->signedDownloadUrl($ebook);

        return response()->json(['url' => $url]);
    }

    /** DELETE /ebooks/{id} — librarian */
    public function destroy(int $id): JsonResponse
    {
        $ebook = Ebook::findOrFail($id);
        $this->ebookService->delete($ebook);

        return response()->json(['message' => 'E-book deleted.']);
    }
}
