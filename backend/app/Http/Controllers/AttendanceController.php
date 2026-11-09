<?php

namespace App\Http\Controllers;

use App\Services\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AttendanceController extends Controller
{
    public function __construct(private AttendanceService $attendanceService) {}

    /** POST /attendance/check-in */
    public function checkIn(Request $request): JsonResponse
    {
        $data = $request->validate([
            'libraryNumber' => ['required', 'string'],
        ]);

        $record = $this->attendanceService->checkIn($data['libraryNumber'], Auth::user()->uid);

        return response()->json(['message' => 'Checked in.', 'record' => $record], 201);
    }

    /** POST /attendance/check-out */
    public function checkOut(Request $request): JsonResponse
    {
        $data = $request->validate([
            'libraryNumber' => ['required', 'string'],
        ]);

        $record = $this->attendanceService->checkOut($data['libraryNumber'], Auth::user()->uid);

        return response()->json(['message' => 'Checked out.', 'record' => $record]);
    }

    /** GET /attendance */
    public function index(Request $request): JsonResponse
    {
        $records = \App\Models\AttendanceRecord::orderBy('check_in_at', 'desc')
            ->paginate($request->integer('per_page', 15));

        return response()->json($records);
    }
}
