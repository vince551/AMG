<?php

namespace App\Services;

use App\Exceptions\ConflictException;
use App\Models\AttendanceRecord;
use App\Models\MemberPresence;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class AttendanceService
{
    public function checkIn(string $libraryNumber, string $librarianUid): AttendanceRecord
    {
        return LibraryTransaction::run(function () use ($libraryNumber, $librarianUid) {
            $member = User::where('library_number', $libraryNumber)->first();
            if (! $member) {
                throw new ModelNotFoundException('Member not found.');
            }

            app(CirculationService::class)->assertEligible($member);
            $presence = MemberPresence::where('uid', $member->uid)->first();

            if ($presence && $presence->status === 'In library') {
                throw new ConflictException('Member is already in the library.');
            }

            // Capacity check
            $capacity = Setting::where('key', 'library')->value('capacity') ?? 100;
            $current = MemberPresence::where('status', 'In library')->count();

            if ($current >= $capacity) {
                throw new ConflictException('Library is at full capacity.');
            }

            $record = AttendanceRecord::create([
                'uid' => $member->uid,
                'member_name' => $member->full_name,
                'library_number' => $member->library_number,
                'check_in_at' => now(),
                'status' => 'In library',
                'recorded_by' => $librarianUid,
            ]);

            MemberPresence::updateOrCreate(
                ['uid' => $member->uid],
                ['status' => 'In library', 'attendance_id' => $record->id]
            );

            ActivityService::record('attendance.check_in', 'attendance', $record->id, [], $librarianUid);

            return $record;
        });
    }

    public function checkOut(string $libraryNumber, string $librarianUid): AttendanceRecord
    {
        return LibraryTransaction::run(function () use ($libraryNumber, $librarianUid) {
            $member = User::where('library_number', $libraryNumber)->first();
            if (! $member) {
                throw new ModelNotFoundException('Member not found.');
            }

            $presence = MemberPresence::where('uid', $member->uid)
                ->where('status', 'In library')
                ->first();

            if (! $presence) {
                throw new ConflictException('Member is not currently in the library.');
            }

            $record = AttendanceRecord::where('uid', $member->uid)
                ->where('status', 'In library')
                ->latest('check_in_at')
                ->firstOrFail();

            $record->update([
                'status' => 'Checked out',
                'check_out_at' => now(),
                'checked_out_by' => $librarianUid,
            ]);

            $presence->update(['status' => 'Checked out', 'attendance_id' => null]);

            ActivityService::record('attendance.check_out', 'attendance', $record->id, [], $librarianUid);

            return $record->fresh();
        });
    }
}
