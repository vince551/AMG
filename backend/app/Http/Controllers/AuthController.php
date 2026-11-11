<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\ActivityService;
use App\Services\AuthService;
use App\Services\LibraryTransaction;
use App\Services\MemberService;
use App\Services\UserService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthController extends Controller
{
    public function __construct(
        private AuthService $authService,
        private MemberService $memberService,
    ) {}

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'photo' => ['sometimes', 'nullable', 'file', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
            'fullName' => ['required', 'string', 'max:160'],
            'email' => ['required', 'email', 'max:191'],
            'password' => ['required', 'string', 'min:8'],
            'gender' => ['required', Rule::in(['Male', 'Female', 'Other', 'Prefer not to say'])],
            'school' => ['required', 'string', 'max:191'],
            'studyLevel' => ['required', 'string', 'max:100'],
            'eduLevel' => ['required', Rule::in(['PP / Pre-Primary', 'Primary', 'Junior Secondary', 'Senior Secondary', 'High School', 'University'])],
            'guardianName' => ['required', 'string', 'max:160'],
            'guardianRelation' => ['required', Rule::in(['Mother', 'Father', 'Guardian'])],
            'guardianPhone' => ['required', 'string', 'max:40'],
        ]);

        $photo = $request->hasFile('photo') ? $request->file('photo') : null;
        $result = $this->authService->register($data, $photo);

        $response = [
            'token' => $result['token'],
            'user' => $result['user'],
        ];

        if (isset($result['warning'])) {
            $response['warning'] = $result['warning'];
        }

        return response()->json($response, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $result = $this->authService->login($data['email'], $data['password']);

        return response()->json([
            'token' => $result['token'],
            'user' => $result['user'],
        ]);
    }

    public function passwordReset(Request $request): JsonResponse
    {
        $request->validate([
            'email' => ['required', 'email'],
        ]);

        $this->authService->passwordReset($request->email);

        return response()->json(['message' => 'If that email is registered, a reset link has been sent.']);
    }

    public function me(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = Auth::user();

        return response()->json($this->authService->me($user, $user));
    }

    public function updateMe(Request $request): JsonResponse
    {
        $rules = UserService::rules($request->user()->role === 'learner');
        foreach ($rules as &$rule) {
            array_unshift($rule, 'sometimes');
        }
        unset($rule);
        $data = $request->validate($rules + [
            'starredBookIds' => ['sometimes', 'array', 'max:500'],
            'starredBookIds.*' => ['integer', 'distinct', 'exists:books,id'],
        ]);

        $user = $this->memberService->updateProfile(Auth::user(), $data);

        return response()->json($user);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'max:128', 'confirmed', 'different:current_password'],
        ]);
        $user = LibraryTransaction::run(function () use ($request, $data) {
            $user = $request->user()->fresh();
            if (! Hash::check($data['current_password'], $user->password)) {
                throw ValidationException::withMessages(['current_password' => ['The current password is incorrect.']]);
            }
            $user->update(['password' => $data['password'], 'must_change_password' => false, 'token_version' => $user->token_version + 1]);
            ActivityService::record('password.changed', 'user', $user->uid);

            return $user;
        });

        return response()->json(['token' => JWTAuth::fromUser($user), 'user' => $this->authService->me($user, $user)]);
    }

    public function completePasswordReset(Request $request): JsonResponse
    {
        $data = $request->validate(['email' => ['required', 'email'], 'token' => ['required', 'string'], 'password' => ['required', 'string', 'min:8', 'max:128', 'confirmed']]);
        $status = Password::reset($data, function ($user, $password) {
            LibraryTransaction::run(function () use ($user, $password) {
                $user->refresh();
                $user->update(['password' => $password, 'must_change_password' => false, 'token_version' => $user->token_version + 1]);
            });
        });
        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['token' => ['This reset link is invalid or expired. Request a new link.']]);
        }

        return response()->json(['message' => 'Password updated. Sign in with your new password.']);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->increment('token_version');

        return response()->json(['message' => 'Logged out.']);
    }

    public function updatePhoto(Request $request): JsonResponse
    {
        $request->validate([
            'photo' => ['required', 'file', 'image', 'mimes:jpeg,png,webp', 'max:5120'],
        ]);

        $user = $this->memberService->updatePhoto(Auth::user(), $request->file('photo'));

        return response()->json(['photoURL' => $user->photo_url]);
    }
}
