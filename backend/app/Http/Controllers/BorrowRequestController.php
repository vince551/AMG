<?php

namespace App\Http\Controllers;

use App\Models\BorrowRequest;
use App\Services\BorrowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class BorrowRequestController extends Controller
{
    public function __construct(private BorrowService $borrowService) {}

    /** GET /borrow-requests — librarian, all requests */
    public function index(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $query = BorrowRequest::query();
        $this->search($query, $request, ['user_name', 'book_title']);
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        $requests = $query->latest()->paginate($size);

        return response()->json($requests);
    }

    /** GET /my/requests — member's own requests */
    public function myRequests(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $query = BorrowRequest::where('user_id', Auth::user()->uid);
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        $this->search($query, $request, ['book_title']);
        $requests = $query->latest()->paginate($size);

        return response()->json($requests);
    }

    /** POST /borrow-requests — member submits a request */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'bookId' => ['required', 'integer', 'exists:books,id'],
        ]);

        $borrowRequest = $this->borrowService->createRequest(Auth::user(), (int) $data['bookId']);

        return response()->json($borrowRequest, 201);
    }

    /** POST /borrow-requests/{id}/approve */
    public function approve(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['copyBarcode' => ['sometimes', 'nullable', 'string', 'max:40']]);
        $borrowRequest = BorrowRequest::findOrFail($id);
        $loan = $this->borrowService->approve($borrowRequest, Auth::user()->uid, $data['copyBarcode'] ?? null);

        return response()->json(['message' => 'Request approved.', 'loan' => $loan]);
    }

    /** POST /borrow-requests/{id}/decline */
    public function decline(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $borrowRequest = BorrowRequest::findOrFail($id);
        $this->borrowService->decline($borrowRequest, Auth::user()->uid, $data['reason']);

        return response()->json(['message' => 'Request declined.']);
    }

    public function cancel(Request $request, int $id): JsonResponse
    {
        $this->borrowService->cancel(BorrowRequest::where('user_id', $request->user()->uid)->findOrFail($id), $request->user());

        return response()->json(['message' => 'Request cancelled.']);
    }
}
