<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use App\Models\Hold;
use App\Models\LibraryNotification;
use App\Models\Loan;
use App\Models\RenewalRequest;
use App\Services\CirculationService;
use App\Services\HoldService;
use App\Services\RenewalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WorkflowController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'activeLoans' => $user->loans()->where('status', 'Borrowed')->count(),
            'overdueLoans' => $user->loans()->where('status', 'Borrowed')->where('due_at', '<', now())->count(),
            'pendingRequests' => $user->borrowRequests()->where('status', 'Pending')->count(),
            'returnedLoans' => $user->loans()->where('status', 'Returned')->count(),
            'readyHolds' => Hold::where('user_id', $user->uid)->where('status', 'Ready')->count(),
            'unreadNotifications' => LibraryNotification::where('user_id', $user->uid)->whereNull('read_at')->count(),
            'visits' => $user->attendanceRecords()->count(),
            'dueLoans' => $user->loans()->where('status', 'Borrowed')->orderBy('due_at')->limit(5)->get(),
        ]);
    }

    public function holds(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $query = Hold::with(['book:id,title,category', 'copy:id,barcode', 'member:uid,full_name,library_number']);
        if ($request->is('api/v1/my/*')) {
            $query->where('user_id', $request->user()->uid);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('search')) {
            $term = '%'.$request->input('search').'%';
            $query->where(fn ($q) => $q->whereHas('book', fn ($b) => $b->where('title', 'like', $term))->orWhereHas('member', fn ($u) => $u->where('full_name', 'like', $term)));
        }

        return response()->json($query->orderBy('created_at')->orderBy('id')->paginate($size));
    }

    public function createHold(Request $request, HoldService $service): JsonResponse
    {
        $data = $request->validate(['bookId' => ['required', 'integer', 'exists:books,id']]);

        return response()->json($service->create($request->user(), $data['bookId']), 201);
    }

    public function cancelHold(Request $request, int $id, HoldService $service): JsonResponse
    {
        $query = Hold::query();
        if ($request->is('api/v1/my/*')) {
            $query->where('user_id', $request->user()->uid);
        }
        $service->cancel($query->findOrFail($id), $request->user());

        return response()->json(['message' => 'Hold cancelled.']);
    }

    public function renewals(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $query = RenewalRequest::with('loan');
        if ($request->is('api/v1/my/*')) {
            $query->where('user_id', $request->user()->uid);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        return response()->json($query->latest()->paginate($size));
    }

    public function requestRenewal(Request $request, int $id, RenewalService $service): JsonResponse
    {
        $loan = Loan::where('user_id', $request->user()->uid)->findOrFail($id);

        return response()->json($service->request($loan, $request->user()), 201);
    }

    public function reviewRenewal(Request $request, int $id, RenewalService $service): JsonResponse
    {
        $data = $request->validate(['decision' => ['required', Rule::in(['Approved', 'Declined'])], 'reason' => ['required_if:decision,Declined', 'nullable', 'string', 'max:1000']]);

        return response()->json($service->decide(RenewalRequest::findOrFail($id), $data['decision'], $data['reason'] ?? null, $request->user()));
    }

    public function reconcileLoan(Request $request, int $id, CirculationService $service): JsonResponse
    {
        $data = $request->validate(['copyBarcode' => ['required', 'string', 'max:40']]);

        return response()->json($service->reconcileLoan(Loan::findOrFail($id), $data['copyBarcode']));
    }

    public function notifications(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $query = LibraryNotification::where('user_id', $request->user()->uid);
        if ($request->input('status') === 'Unread') {
            $query->whereNull('read_at');
        }

        return response()->json($query->latest()->paginate($size));
    }

    public function readNotifications(Request $request): JsonResponse
    {
        $data = $request->validate(['all' => ['sometimes', 'boolean'], 'ids' => ['required_without:all', 'array', 'max:100'], 'ids.*' => ['integer']]);
        $query = LibraryNotification::where('user_id', $request->user()->uid)->whereNull('read_at');
        if (! $request->boolean('all')) {
            $query->whereIn('id', $data['ids'] ?? []);
        }
        $query->update(['read_at' => now()]);

        return response()->json(['message' => 'Notifications marked as read.']);
    }

    public function activity(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $query = ActivityLog::query()->leftJoin('users', 'users.uid', '=', 'activity_logs.actor_id')->select('activity_logs.*', 'users.full_name as actor_name');
        $this->search($query, $request, ['activity_logs.action', 'users.full_name', 'activity_logs.entity_type']);
        if ($request->filled('from')) {
            $query->whereDate('activity_logs.created_at', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('activity_logs.created_at', '<=', $request->input('to'));
        }

        return response()->json($query->orderByDesc('activity_logs.id')->paginate($size));
    }
}
