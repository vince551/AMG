<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attendance_records', function (Blueprint $table) {
            $table->id();
            $table->string('uid', 36);          // users.uid
            $table->string('member_name', 160);
            $table->string('library_number', 20);
            $table->timestamp('check_in_at')->useCurrent();
            $table->timestamp('check_out_at')->nullable();
            $table->enum('status', ['In library', 'Checked out'])->default('In library');
            $table->string('recorded_by', 36)->nullable();
            $table->string('checked_out_by', 36)->nullable();
            $table->timestamps();

            $table->index(['uid', 'status']);
            $table->index('check_in_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attendance_records');
    }
};
