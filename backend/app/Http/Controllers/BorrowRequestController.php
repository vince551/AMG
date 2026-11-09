<?php

namespace App\Http\Controllers;

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
        $requests = \App\Models\BorrowRequest::orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 15));

        return response()->json($requests);
    }

    /** GET /my/requests — member's own requests */
    public function myRequests(Request $request): JsonResponse
    {
        $requests = \App\Models\BorrowRequest::where('user_id', Auth::user()->uid)
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 15));

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
    public function approve(int $id): JsonResponse
    {
        $borrowRequest = \App\Models\BorrowRequest::findOrFail($id);
        $loan          = $this->borrowService->approve($borrowRequest, Auth::user()->uid);

        return response()->json(['message' => 'Request approved.', 'loan' => $loan]);
    }

    /** POST /borrow-requests/{id}/decline */
    public function decline(int $id): JsonResponse
    {
        $borrowRequest = \App\Models\BorrowRequest::findOrFail($id);
        $this->borrowService->decline($borrowRequest, Auth::user()->uid);

        return response()->json(['message' => 'Request declined.']);
    }
}
