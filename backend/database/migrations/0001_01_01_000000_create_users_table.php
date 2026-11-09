<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->uuid('uid')->unique();
            $table->string('email', 191)->unique();
            $table->string('password');
            $table->string('full_name', 160);
            $table->enum('gender', ['Male', 'Female', 'Other', 'Prefer not to say']);
            $table->string('school', 191);
            $table->string('study_level', 100);
            $table->enum('edu_level', ['PP / Pre-Primary', 'Primary', 'Junior Secondary', 'Senior Secondary', 'High School', 'University']);
            $table->string('guardian_name', 160);
            $table->enum('guardian_relation', ['Mother', 'Father', 'Guardian']);
            $table->string('guardian_phone', 40);
            $table->string('library_number', 20)->unique()->nullable();
            $table->enum('role', ['librarian', 'learner'])->default('learner');
            $table->boolean('is_approved')->default(false);
            $table->enum('membership_status', ['Pending', 'Approved', 'Denied'])->default('Pending');
            $table->string('photo_url', 500)->nullable();
            $table->string('photo_storage_path', 500)->nullable();
            $table->json('starred_book_ids')->default('[]');
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('denied_at')->nullable();
            $table->string('decision_by', 36)->nullable();
            $table->timestamps();
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
    }
};
