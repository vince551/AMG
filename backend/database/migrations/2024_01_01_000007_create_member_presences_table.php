<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_presences', function (Blueprint $table) {
            $table->id();
            $table->string('uid', 36)->unique();  // users.uid
            $table->foreignId('attendance_id')->nullable()->constrained('attendance_records')->nullOnDelete();
            $table->enum('status', ['In library', 'Checked out'])->default('Checked out');
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_presences');
    }
};
