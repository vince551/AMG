<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    use HasFactory, Notifiable;

    protected $fillable = [
        'uid',
        'email',
        'password',
        'full_name',
        'gender',
        'school',
        'study_level',
        'edu_level',
        'guardian_name',
        'guardian_relation',
        'guardian_phone',
        'library_number',
        'role',
        'is_approved',
        'membership_status',
        'photo_url',
        'photo_storage_path',
        'starred_book_ids',
        'approved_at',
        'denied_at',
        'decision_by',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'guardian_name',
        'guardian_relation',
        'guardian_phone',
        'photo_storage_path',
    ];

    protected function casts(): array
    {
        return [
            'password'         => 'hashed',
            'is_approved'      => 'boolean',
            'starred_book_ids' => 'array',
            'approved_at'      => 'datetime',
            'denied_at'        => 'datetime',
        ];
    }

    // ── JWT ──────────────────────────────────────────────────────────────────

    public function getJWTIdentifier(): mixed
    {
        return $this->getKey();
    }

    public function getJWTCustomClaims(): array
    {
        return [
            'uid'  => $this->uid,
            'role' => $this->role,
        ];
    }

    // ── Relationships ────────────────────────────────────────────────────────

    public function loans(): HasMany
    {
        return $this->hasMany(Loan::class, 'user_id', 'uid');
    }

    public function borrowRequests(): HasMany
    {
        return $this->hasMany(BorrowRequest::class, 'user_id', 'uid');
    }

    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(AttendanceRecord::class, 'uid', 'uid');
    }

    public function presence(): HasOne
    {
        return $this->hasOne(MemberPresence::class, 'uid', 'uid');
    }
}
