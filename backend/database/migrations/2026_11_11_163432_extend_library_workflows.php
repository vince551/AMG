<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 20)->default('learner')->change();
            $table->string('gender', 30)->nullable()->change();
            $table->string('school', 191)->nullable()->change();
            $table->string('study_level', 100)->nullable()->change();
            $table->string('edu_level', 40)->nullable()->change();
            $table->string('guardian_name', 160)->nullable()->change();
            $table->string('guardian_relation', 20)->nullable()->change();
            $table->string('guardian_phone', 40)->nullable()->change();
            $table->boolean('is_active')->default(true)->index();
            $table->boolean('must_change_password')->default(false);
            $table->unsignedInteger('token_version')->default(0);
            $table->text('decision_reason')->nullable();
        });
        Schema::table('books', function (Blueprint $table) {
            $table->dateTime('archived_at')->nullable()->index();
        });
        Schema::table('book_copies', function (Blueprint $table) {
            $table->string('status', 20)->default('Available')->change();
            $table->unique(['book_id', 'copy_number']);
        });
        Schema::table('borrow_requests', function (Blueprint $table) {
            $table->string('status', 20)->default('Pending')->change();
            $table->text('reason')->nullable();
        });
        Schema::table('loans', function (Blueprint $table) {
            $table->unsignedSmallInteger('renewal_count')->default(0);
        });
        Schema::table('settings', function (Blueprint $table) {
            $table->string('name', 160)->default('AMG Library');
            $table->string('contact', 191)->nullable();
            $table->string('hours', 191)->nullable();
            $table->unsignedSmallInteger('loan_days')->default(14);
            $table->unsignedSmallInteger('loan_limit')->default(5);
            $table->unsignedSmallInteger('renewal_limit')->default(1);
            $table->unsignedSmallInteger('renewal_days')->default(14);
            $table->unsignedSmallInteger('hold_hours')->default(48);
        });
        DB::table('settings')->insertOrIgnore(['key' => 'library', 'capacity' => 100]);
        Schema::table('posts', function (Blueprint $table) {
            $table->boolean('is_published')->default(true)->index();
        });
        Schema::create('holds', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 36);
            $table->foreign('user_id')->references('uid')->on('users');
            $table->foreignId('book_id')->constrained();
            $table->foreignId('book_copy_id')->nullable()->constrained('book_copies');
            $table->string('status', 20)->default('Waiting');
            $table->string('active_key', 100)->nullable()->unique();
            $table->dateTime('expires_at')->nullable();
            $table->timestamps();
            $table->index(['book_id', 'status', 'created_at']);
            $table->index(['user_id', 'status']);
        });
        Schema::create('renewal_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('loan_id')->constrained();
            $table->string('user_id', 36);
            $table->foreign('user_id')->references('uid')->on('users');
            $table->string('status', 20)->default('Pending');
            $table->unsignedBigInteger('active_loan_id')->nullable()->unique();
            $table->text('reason')->nullable();
            $table->string('processed_by', 36)->nullable();
            $table->dateTime('processed_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'status']);
        });
        Schema::create('library_notifications', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 36);
            $table->foreign('user_id')->references('uid')->on('users');
            $table->string('title', 160);
            $table->text('message');
            $table->string('section', 40)->default('overview');
            $table->string('dedupe_key', 191)->unique();
            $table->dateTime('read_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'read_at']);
        });
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->string('actor_id', 36)->nullable()->index();
            $table->string('action', 80)->index();
            $table->string('entity_type', 80);
            $table->string('entity_id', 80)->nullable();
            $table->json('metadata')->nullable();
            $table->dateTime('created_at')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('library_notifications');
        Schema::dropIfExists('renewal_requests');
        Schema::dropIfExists('holds');
        Schema::table('posts', fn (Blueprint $table) => $table->dropColumn('is_published'));
        Schema::table('settings', fn (Blueprint $table) => $table->dropColumn(['name', 'contact', 'hours', 'loan_days', 'loan_limit', 'renewal_limit', 'renewal_days', 'hold_hours']));
        Schema::table('loans', fn (Blueprint $table) => $table->dropColumn('renewal_count'));
        Schema::table('borrow_requests', fn (Blueprint $table) => $table->dropColumn('reason'));
        Schema::table('book_copies', fn (Blueprint $table) => $table->dropUnique(['book_id', 'copy_number']));
        Schema::table('books', fn (Blueprint $table) => $table->dropColumn('archived_at'));
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn(['is_active', 'must_change_password', 'token_version', 'decision_reason']));
    }
};
