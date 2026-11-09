<?php

namespace App\Http\Controllers;

use App\Services\AuthService;
use App\Services\MemberService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function __construct(
        private AuthService   $authService,
        private MemberService $memberService,
    ) {}

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'fullName'         => ['required', 'string', 'max:160'],
            'email'            => ['required', 'email', 'max:191'],
            'password'         => ['required', 'string', 'min:8'],
            'gender'           => ['required', Rule::in(['Male', 'Female', 'Other', 'Prefer not to say'])],
            'school'           => ['required', 'string', 'max:191'],
            'studyLevel'       => ['required', 'string', 'max:100'],
            'eduLevel'         => ['required', Rule::in(['PP / Pre-Primary', 'Primary', 'Junior Secondary', 'Senior Secondary', 'High School', 'University'])],
            'guardianName'     => ['required', 'string', 'max:160'],
            'guardianRelation' => ['required', Rule::in(['Mother', 'Father', 'Guardian'])],
            'guardianPhone'    => ['required', 'string', 'max:40'],
        ]);

        $photo  = $request->hasFile('photo') ? $request->file('photo') : null;
        $result = $this->authService->register($data, $photo);

        $response = [
            'token' => $result['token'],
            'user'  => $result['user'],
        ];

        if (isset($result['warning'])) {
            $response['warning'] = $result['warning'];
        }

        return response()->json($response, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $result = $this->authService->login($data['email'], $data['password']);

        return response()->json([
            'token' => $result['token'],
            'user'  => $result['user'],
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
        /** @var \App\Models\User $user */
        $user = Auth::user();

        return response()->json($this->authService->me($user, $user));
    }

    public function updateMe(Request $request): JsonResponse
    {
        $data = $request->validate([
            'starredBookIds' => ['sometimes', 'array'],
            'starredBookIds.*' => ['integer'],
        ]);

        $user = $this->memberService->updateProfile(Auth::user(), $data);

        return response()->json($user);
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
