<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\MemberNumber;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Auth\AuthenticationException;
use Tymon\JWTAuth\Facades\JWTAuth;

class AuthService
{
    private const MAX_LIBRARY_NUMBER_RETRIES = 30;

    /**
     * Register a new member.
     *
     * @return array{token: string, user: User, warning?: string}
     */
    public function register(array $data, ?UploadedFile $photo = null): array
    {
        // Check email uniqueness
        if (User::where('email', $data['email'])->exists()) {
            throw new ConflictException('An account with this email already exists.');
        }

        $uid            = (string) Str::uuid();
        $libraryNumber  = $this->reserveLibraryNumber($uid);
        $warning        = null;
        $photoUrl       = null;
        $photoPath      = null;

        // Handle optional photo upload
        if ($photo !== null) {
            if ($photo->getSize() > 5 * 1024 * 1024 || ! str_starts_with($photo->getMimeType() ?? '', 'image/')) {
                $warning = 'Profile photo was not saved: file must be an image under 5 MB.';
            } else {
                $photoPath = $photo->store('photos', 'public');
                $photoUrl  = Storage::disk('public')->url($photoPath);
            }
        }

        $user = User::create([
            'uid'               => $uid,
            'email'             => $data['email'],
            'password'          => Hash::make($data['password']),
            'full_name'         => $data['fullName'],
            'gender'            => $data['gender'],
            'school'            => $data['school'],
            'study_level'       => $data['studyLevel'],
            'edu_level'         => $data['eduLevel'],
            'guardian_name'     => $data['guardianName'],
            'guardian_relation' => $data['guardianRelation'],
            'guardian_phone'    => $data['guardianPhone'],
            'library_number'    => $libraryNumber,
            'role'              => 'learner',
            'is_approved'       => false,
            'membership_status' => 'Pending',
            'photo_url'         => $photoUrl,
            'photo_storage_path'=> $photoPath,
            'starred_book_ids'  => [],
        ]);

        $token = JWTAuth::fromUser($user);

        $result = ['token' => $token, 'user' => $user->makeVisible(['guardian_name', 'guardian_relation', 'guardian_phone'])];
        if ($warning) {
            $result['warning'] = $warning;
        }

        return $result;
    }

    /**
     * Log in a user and return a JWT.
     *
     * @return array{token: string, user: User}
     */
    public function login(string $email, string $password): array
    {
        $user = User::where('email', $email)->first();

        if (! $user || ! Hash::check($password, $user->password)) {
            throw new AuthenticationException('Invalid credentials.');
        }

        $token = JWTAuth::fromUser($user);

        return ['token' => $token, 'user' => $user];
    }

    /**
     * Return the full user record for the given user.
     * Guardian fields are included only if the requester is the owning member or a librarian.
     *
     * @return array<string, mixed>
     */
    public function me(User $user, User $requester): array
    {
        $data = [
            'uid'               => $user->uid,
            'email'             => $user->email,
            'full_name'         => $user->full_name,
            'gender'            => $user->gender,
            'school'            => $user->school,
            'study_level'       => $user->study_level,
            'edu_level'         => $user->edu_level,
            'library_number'    => $user->library_number,
            'role'              => $user->role,
            'is_approved'       => $user->is_approved,
            'membership_status' => $user->membership_status,
            'photo_url'         => $user->photo_url,
            'starred_book_ids'  => $user->starred_book_ids ?? [],
            'approved_at'       => $user->approved_at,
            'denied_at'         => $user->denied_at,
            'decision_by'       => $user->decision_by,
            'created_at'        => $user->created_at,
            'updated_at'        => $user->updated_at,
        ];

        $isOwner     = $requester->uid === $user->uid;
        $isLibrarian = $requester->role === 'librarian';

        if ($isOwner || $isLibrarian) {
            $data['guardian_name']     = $user->guardian_name;
            $data['guardian_relation'] = $user->guardian_relation;
            $data['guardian_phone']    = $user->guardian_phone;
        }

        return $data;
    }

    /**
     * Send a password reset email (silent on unknown email).
     */
    public function passwordReset(string $email): void
    {
        // Fire-and-forget — never reveal whether the email exists
        Password::sendResetLink(['email' => $email]);
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private function reserveLibraryNumber(string $uid): string
    {
        for ($i = 0; $i < self::MAX_LIBRARY_NUMBER_RETRIES; $i++) {
            $number = 'AMG-'.str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

            $inserted = DB::table('member_numbers')->insertOrIgnore([
                'library_number' => $number,
                'uid'            => $uid,
                'created_at'     => now(),
            ]);

            if ($inserted) {
                return $number;
            }
        }

        throw new \RuntimeException('Could not assign a unique library number after '.self::MAX_LIBRARY_NUMBER_RETRIES.' attempts.');
    }
}
