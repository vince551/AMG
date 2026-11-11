<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AuthService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $request->validate(['role' => ['sometimes', Rule::in(['admin', 'librarian', 'learner'])], 'active' => ['sometimes', Rule::in(['0', '1'])]]);
        $query = User::query();
        if (! $request->user()->isStaff() || $request->user()->role !== 'admin' || $request->is('api/v1/members*')) {
            $query->where('role', 'learner');
        }
        if ($request->filled('role')) {
            $query->where('role', $request->input('role'));
        }
        if ($request->filled('status')) {
            $query->where('membership_status', $request->input('status'));
        }
        if ($request->has('active')) {
            $query->where('is_active', $request->boolean('active'));
        }
        $this->search($query, $request, ['full_name', 'email', 'library_number']);
        $page = $query->latest()->paginate($size);
        $page->getCollection()->each->makeVisible(['guardian_name', 'guardian_relation', 'guardian_phone']);

        return response()->json($page);
    }

    public function show(Request $request, string $uid): JsonResponse
    {
        $user = $this->target($request, $uid);

        return response()->json(app(AuthService::class)->me($user, $request->user()));
    }

    public function store(Request $request, UserService $service): JsonResponse
    {
        return response()->json($service->save($request->all(), $request->user()), 201);
    }

    public function update(Request $request, string $uid, UserService $service): JsonResponse
    {
        return response()->json($service->save($request->all(), $request->user(), $this->target($request, $uid)));
    }

    public function resetCredential(Request $request, string $uid, UserService $service): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'string', 'min:8', 'max:128', 'confirmed']]);
        $service->resetCredential($this->target($request, $uid), $data['password'], $request->user());

        return response()->json(['message' => 'Temporary password set. Existing sessions were revoked.']);
    }

    private function target(Request $request, string $uid): User
    {
        $user = User::where('uid', $uid)->firstOrFail();
        abort_if(($request->user()->role !== 'admin' || $request->is('api/v1/members*')) && $user->role !== 'learner', 403);

        return $user;
    }
}
