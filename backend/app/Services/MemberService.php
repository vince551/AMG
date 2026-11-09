<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\User;
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
        $allowed = array_intersect_key($data, array_flip(['starredBookIds']));

        if (isset($allowed['starredBookIds'])) {
            $user->starred_book_ids = $allowed['starredBookIds'];
            $user->save();
        }

        return $user->fresh();
    }

    /**
     * Replace the member's profile photo.
     * The controller has already validated: image, max 5 MB, mimes jpeg/png/webp.
     */
    public function updatePhoto(User $user, UploadedFile $photo): User
    {
        // Delete old photo if stored
        if ($user->photo_storage_path) {
            Storage::disk('public')->delete($user->photo_storage_path);
        }

        $path = $photo->store('photos', 'public');
        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk     = Storage::disk('public');
        $photoUrl = $disk->url($path);

        $user->update([
            'photo_url'          => $photoUrl,
            'photo_storage_path' => $path,
        ]);

        return $user->fresh();
    }

    /**
     * Approve or deny a pending membership application.
     */
    public function reviewMembership(User $member, string $decision, string $librarianUid): User
    {
        if ($member->membership_status !== 'Pending') {
            throw new ConflictException('This membership application has already been reviewed.');
        }

        $now = now();

        if ($decision === 'Approved') {
            $member->update([
                'is_approved'       => true,
                'membership_status' => 'Approved',
                'approved_at'       => $now,
                'decision_by'       => $librarianUid,
            ]);
        } else {
            $member->update([
                'is_approved'       => false,
                'membership_status' => 'Denied',
                'denied_at'         => $now,
                'decision_by'       => $librarianUid,
            ]);
        }

        return $member->fresh();
    }
}
