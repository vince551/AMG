<?php

namespace App\Http\Controllers;

use App\Services\PostService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class PostController extends Controller
{
    public function __construct(private PostService $postService) {}

    /** GET /posts — public combined feed */
    public function index(): JsonResponse
    {
        $posts = $this->postService->combinedFeed();
        return response()->json($posts);
    }

    /** POST /posts — librarian publishes */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type'  => ['required', Rule::in(['announcement', 'event'])],
            'title' => ['required', 'string', 'max:255'],
            'body'  => ['required', 'string'],
            'date'  => ['sometimes', 'nullable', 'date'],
        ]);

        $post = $this->postService->publish($data, Auth::user()->uid);

        return response()->json($post, 201);
    }

    /** DELETE /posts/{type}/{id} — librarian deletes */
    public function destroy(string $type, int $id): JsonResponse
    {
        $post = \App\Models\Post::where('type', $type)->findOrFail($id);
        $post->delete();

        return response()->json(['message' => 'Post deleted.']);
    }
}
