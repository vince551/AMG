<?php

namespace App\Http\Controllers;

use App\Services\EbookService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class EbookController extends Controller
{
    public function __construct(private EbookService $ebookService) {}

    /** GET /ebooks — public catalogue (no file URLs) */
    public function index(Request $request): JsonResponse
    {
        $ebooks = \App\Models\Ebook::orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 15));

        return response()->json($ebooks);
    }

    /** POST /ebooks — librarian uploads */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'    => ['required', 'string', 'max:160'],
            'category' => ['sometimes', 'nullable', 'string', 'max:60'],
            'file'     => ['required', 'file', 'mimes:pdf,epub', 'max:30720'],
        ]);

        $ebook = $this->ebookService->upload($data, $request->file('file'), Auth::user()->uid);

        return response()->json($ebook, 201);
    }

    /** GET /ebooks/{id}/download-url — authenticated member */
    public function downloadUrl(int $id): JsonResponse
    {
        $ebook = \App\Models\Ebook::findOrFail($id);
        $url   = $this->ebookService->signedDownloadUrl($ebook);

        return response()->json(['url' => $url]);
    }

    /** DELETE /ebooks/{id} — librarian */
    public function destroy(int $id): JsonResponse
    {
        $ebook = \App\Models\Ebook::findOrFail($id);
        $this->ebookService->delete($ebook);

        return response()->json(['message' => 'E-book deleted.']);
    }
}
