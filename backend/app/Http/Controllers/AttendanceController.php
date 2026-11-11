<?php

namespace App\Http\Controllers;

use App\Models\AttendanceRecord;
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
        $size = $this->perPage($request);
        $query = AttendanceRecord::query();
        if ($request->is('api/v1/my/*')) {
            $query->where('uid', $request->user()->uid);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('from')) {
            $query->whereDate('check_in_at', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('check_in_at', '<=', $request->input('to'));
        }
        $this->search($query, $request, ['member_name', 'library_number']);

        return response()->json($query->latest('check_in_at')->paginate($size));
    }
}
