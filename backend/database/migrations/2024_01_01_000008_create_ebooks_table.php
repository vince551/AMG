<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ebooks', function (Blueprint $table) {
            $table->id();
            $table->string('title', 160);
            $table->string('category', 60)->nullable();
            $table->string('file_name', 255);
            $table->string('storage_path', 500);
            $table->unsignedBigInteger('size');  // bytes
            $table->string('uploaded_by', 36);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ebooks');
    }
};
