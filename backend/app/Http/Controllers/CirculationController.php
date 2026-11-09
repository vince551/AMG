<?php

namespace App\Http\Controllers;

use App\Services\CirculationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CirculationController extends Controller
{
    public function __construct(private CirculationService $circulationService) {}

    /** POST /circulation/issue */
    public function issue(Request $request): JsonResponse
    {
        $data = $request->validate([
            'libraryNumber' => ['required', 'string'],
            'copyBarcode'   => ['required', 'string'],
        ]);

        $loan = $this->circulationService->issue(
            $data['libraryNumber'],
            $data['copyBarcode'],
            Auth::user()->uid
        );

        return response()->json(['message' => 'Book issued successfully.', 'loan' => $loan], 201);
    }

    /** POST /circulation/return */
    public function returnCopy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'copyBarcode' => ['required', 'string'],
        ]);

        $loan = $this->circulationService->returnCopy($data['copyBarcode'], Auth::user()->uid);

        return response()->json(['message' => 'Book returned successfully.', 'loan' => $loan]);
    }
}
