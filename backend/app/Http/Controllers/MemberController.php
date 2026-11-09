<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\MemberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class MemberController extends Controller
{
    public function __construct(private MemberService $memberService) {}

    /** GET /members — all members, paginated */
    public function index(Request $request): JsonResponse
    {
        $members = User::where('role', 'learner')
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 15));

        // Librarians can see guardian fields
        $members->getCollection()->transform(
            fn (User $u) => $u->makeVisible(['guardian_name', 'guardian_relation', 'guardian_phone'])
        );

        return response()->json($members);
    }

    /** GET /members/pending — pending membership applications */
    public function pending(Request $request): JsonResponse
    {
        $members = User::where('role', 'learner')
            ->where('is_approved', false)
            ->where('membership_status', 'Pending')
            ->orderBy('created_at', 'desc')
            ->paginate($request->integer('per_page', 15));

        $members->getCollection()->transform(
            fn (User $u) => $u->makeVisible(['guardian_name', 'guardian_relation', 'guardian_phone'])
        );

        return response()->json($members);
    }

    /** POST /members/{uid}/review — approve or deny */
    public function review(Request $request, string $uid): JsonResponse
    {
        $data = $request->validate([
            'decision' => ['required', Rule::in(['Approved', 'Denied'])],
        ]);

        $member = User::where('uid', $uid)->where('role', 'learner')->firstOrFail();

        $updated = $this->memberService->reviewMembership(
            $member,
            $data['decision'],
            Auth::user()->uid
        );

        return response()->json(
            $updated->makeVisible(['guardian_name', 'guardian_relation', 'guardian_phone'])
        );
    }
}
