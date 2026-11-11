<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserService
{
    public const PROFILE_FIELDS = ['full_name', 'gender', 'school', 'study_level', 'edu_level', 'guardian_name', 'guardian_relation', 'guardian_phone'];

    public static function rules(bool $learner): array
    {
        $required = $learner ? 'required' : 'nullable';

        return [
            'full_name' => ['required', 'string', 'max:160'],
            'gender' => [$required, Rule::in(['Male', 'Female', 'Other', 'Prefer not to say'])],
            'school' => [$required, 'string', 'max:191'],
            'study_level' => [$required, 'string', 'max:100'],
            'edu_level' => [$required, Rule::in(['PP / Pre-Primary', 'Primary', 'Junior Secondary', 'Senior Secondary', 'High School', 'University'])],
            'guardian_name' => [$required, 'string', 'max:160'],
            'guardian_relation' => [$required, Rule::in(['Mother', 'Father', 'Guardian'])],
            'guardian_phone' => [$required, 'string', 'max:40'],
        ];
    }

    public function save(array $input, User $actor, ?User $target = null): User
    {
        return LibraryTransaction::run(function () use ($input, $actor, $target) {
            $actor = User::where('uid', $actor->uid)->firstOrFail();
            abort_unless($actor->is_active && $actor->isStaff(), 403);
            $target = $target ? User::whereKey($target->id)->lockForUpdate()->firstOrFail() : null;
            $role = $input['role'] ?? $target?->role ?? 'learner';
            abort_if($actor->role !== 'admin' && ($role !== 'learner' || ($target && $target->role !== 'learner')), 403);
            abort_if($actor->role !== 'admin' && array_key_exists('is_active', $input), 403);
            $values = array_merge($target?->getAttributes() ?? [], $input);
            $values['role'] = $role;
            $values['email'] = mb_strtolower(trim($values['email'] ?? ''));
            $data = Validator::make($values, array_merge(self::rules($role === 'learner'), [
                'email' => ['required', 'email', 'max:191', Rule::unique('users', 'email')->ignore($target?->id)],
                'role' => ['required', Rule::in(['admin', 'librarian', 'learner'])],
                'is_active' => ['sometimes', 'boolean'],
            ]))->validate();
            if ($target && $target->role !== $role && ($target->loans()->where('status', 'Borrowed')->exists() || $target->presence()->where('status', 'In library')->exists())) {
                throw new ConflictException('Return outstanding loans and check out this member before changing roles.');
            }
            if ($target && ! ($data['is_active'] ?? true) && $actor->uid === $target->uid) {
                throw new ConflictException('You cannot deactivate your own account.');
            }
            if ($target?->role === 'admin' && ($role !== 'admin' || ! ($data['is_active'] ?? true)) && ! User::where('role', 'admin')->where('is_active', true)->where('id', '!=', $target->id)->exists()) {
                throw new ConflictException('Keep at least one active administrator.');
            }
            if (! $target) {
                $password = Validator::make($input, ['password' => ['required', 'string', 'min:8', 'max:128']])->validate()['password'];
                $uid = (string) Str::uuid();
                $data += ['uid' => $uid, 'password' => Hash::make($password), 'must_change_password' => true, 'starred_book_ids' => []];
                $data['library_number'] = $role === 'learner' ? app(AuthService::class)->reserveLibraryNumber($uid) : null;
                $data['is_approved'] = $role !== 'learner';
                $data['membership_status'] = $role === 'learner' ? 'Pending' : 'Approved';
                $target = User::create($data);
                ActivityService::record('user.created', 'user', $uid, ['role' => $role], $actor->uid);
            } else {
                if ($target->role !== $role || $target->is_active !== (bool) ($data['is_active'] ?? $target->is_active)) {
                    $data['token_version'] = $target->token_version + 1;
                }
                if ($target->role !== $role) {
                    $data['is_approved'] = $role !== 'learner';
                    $data['membership_status'] = $role === 'learner' ? 'Pending' : 'Approved';
                    if ($role === 'learner' && ! $target->library_number) {
                        $data['library_number'] = app(AuthService::class)->reserveLibraryNumber($target->uid);
                    }
                }
                $target->update($data);
                ActivityService::record('user.updated', 'user', $target->uid, ['fields' => array_keys($data)], $actor->uid);
            }

            return $target->fresh()->makeVisible(['guardian_name', 'guardian_relation', 'guardian_phone']);
        });
    }

    public function resetCredential(User $target, string $password, User $actor): void
    {
        abort_unless($actor->role === 'admin', 403);
        LibraryTransaction::run(function () use ($target, $password, $actor) {
            $target->refresh();
            $target->update(['password' => Hash::make($password), 'must_change_password' => true, 'token_version' => $target->token_version + 1]);
            ActivityService::record('user.credentials_reset', 'user', $target->uid, [], $actor->uid);
        });
    }
}
