<?php

namespace App\Http\Controllers;

use App\Models\Loan;
use App\Services\LoanService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LoanController extends Controller
{
    public function __construct(private LoanService $loanService) {}

    /** GET /loans — librarian */
    public function index(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $request->validate(['user_id' => ['sometimes', 'uuid']]);
        $query = Loan::with('bookCopy');
        if ($request->is('api/v1/my/*')) {
            $query->where('user_id', $request->user()->uid);
        } elseif ($request->filled('user_id')) {
            $query->where('user_id', $request->input('user_id'));
        }
        if ($request->input('status') === 'Overdue') {
            $query->where('status', 'Borrowed')->where('due_at', '<', now());
        } elseif ($request->input('status') === 'Unassigned') {
            $query->where('status', 'Borrowed')->whereNull('book_copy_id');
        } elseif ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        $this->search($query, $request, ['book_title', 'user_name']);

        return response()->json($query->latest()->paginate($size));
    }

    /** GET /my/loans — member */
    public function myLoans(Request $request): JsonResponse
    {
        return $this->index($request);
    }

    /** POST /loans/{id}/return */
    public function returnLoan(int $id): JsonResponse
    {
        $loan = Loan::findOrFail($id);
        $this->loanService->returnLoan($loan, Auth::user()->uid);

        return response()->json(['message' => 'Book returned successfully.', 'loan' => $loan->fresh()]);
    }
}
