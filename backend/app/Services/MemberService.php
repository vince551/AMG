<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\User;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class MemberService
{
    /**
     * Update allowed profile fields (starredBookIds only; photoURL is handled separately).
     */
    public function updateProfile(User $user, array $data): User
    {
        // Only allow starredBookIds — strip any protected fields silently
        $allowed = array_intersect_key($data, array_flip(array_merge(UserService::PROFILE_FIELDS, ['starredBookIds'])));

        if (isset($allowed['starredBookIds'])) {
            $user->starred_book_ids = $allowed['starredBookIds'];
            $user->save();
        }

        $user->fill(array_intersect_key($allowed, array_flip(UserService::PROFILE_FIELDS)))->save();

        return $user->fresh()->makeVisible(['guardian_name', 'guardian_relation', 'guardian_phone']);
    }

    /**
     * Replace the member's profile photo.
     * The controller has already validated: image, max 5 MB, mimes jpeg/png/webp.
     */
    public function updatePhoto(User $user, UploadedFile $photo): User
    {
        $oldPath = $user->photo_storage_path;
        $path = $photo->store('photos', 'public');
        if (! $path) {
            throw new \RuntimeException('Photo could not be stored.');
        }
        /** @var FilesystemAdapter $disk */
        $disk = Storage::disk('public');
        $photoUrl = $disk->url($path);

        try {
            $user->update(['photo_url' => $photoUrl, 'photo_storage_path' => $path]);
        } catch (\Throwable $error) {
            Storage::disk('public')->delete($path);
            throw $error;
        }
        if ($oldPath) {
            Storage::disk('public')->delete($oldPath);
        }

        return $user->fresh();
    }

    /**
     * Approve or deny a pending membership application.
     */
    public function reviewMembership(User $member, string $decision, string $librarianUid, ?string $reason = null): User
    {
        return LibraryTransaction::run(function () use ($member, $decision, $librarianUid, $reason) {
            $member->refresh();
            if ($member->membership_status !== 'Pending') {
                throw new ConflictException('This membership application has already been reviewed.');
            }

            $now = now();

            if ($decision === 'Approved') {
                $member->update([
                    'is_approved' => true,
                    'membership_status' => 'Approved',
                    'approved_at' => $now,
                    'decision_by' => $librarianUid,
                ]);
            } else {
                $member->update([
                    'is_approved' => false,
                    'membership_status' => 'Denied',
                    'denied_at' => $now,
                    'decision_by' => $librarianUid,
                ]);
            }

            $member->update(['decision_reason' => $reason]);
            ActivityService::record('membership.reviewed', 'user', $member->uid, ['status' => $decision], $librarianUid);
            ActivityService::notify($member->uid, 'Membership '.$decision, $reason ?: 'Your membership has been '.strtolower($decision).'.', 'profile');

            return $member->fresh();
        });
    }
}
