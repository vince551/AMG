<?php

namespace App\Http\Controllers;

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
        $loans = \App\Models\Loan::orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 15));

        return response()->json($loans);
    }

    /** GET /my/loans — member */
    public function myLoans(Request $request): JsonResponse
    {
        $loans = \App\Models\Loan::where('user_id', Auth::user()->uid)
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 15));

        return response()->json($loans);
    }

    /** POST /loans/{id}/return */
    public function returnLoan(int $id): JsonResponse
    {
        $loan = \App\Models\Loan::findOrFail($id);
        $this->loanService->returnLoan($loan, Auth::user()->uid);

        return response()->json(['message' => 'Book returned successfully.', 'loan' => $loan->fresh()]);
    }
}
