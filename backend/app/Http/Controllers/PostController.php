<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Services\ActivityService;
use App\Services\LibraryTransaction;
use App\Services\PostService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class PostController extends Controller
{
    public function __construct(private PostService $postService) {}

    /** GET /posts — public combined feed */
    public function index(Request $request): JsonResponse
    {
        $size = $this->perPage($request);
        $request->validate(['type' => ['sometimes', Rule::in(['announcement', 'event'])], 'published' => ['sometimes', 'boolean']]);
        $query = Post::query();
        if (! $request->is('api/v1/content/*')) {
            $query->where('is_published', true);
        } elseif ($request->has('published')) {
            $query->where('is_published', $request->boolean('published'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }
        $this->search($query, $request, ['title', 'body']);

        return response()->json($query->latest()->paginate($size));
    }

    /** POST /posts — librarian publishes */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in(['announcement', 'event'])],
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
            'date' => ['required_if:type,event', 'nullable', 'date_format:Y-m-d'],
            'is_published' => ['sometimes', 'boolean'],
        ]);

        $post = $this->postService->publish($data, Auth::user()->uid);

        return response()->json($post, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $post = Post::findOrFail($id);
        $data = Validator::make(array_merge($post->toArray(), $request->only(['type', 'title', 'body', 'date', 'is_published'])), [
            'type' => ['required', Rule::in(['announcement', 'event'])],
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:20000'],
            'date' => ['required_if:type,event', 'nullable', 'date'],
            'is_published' => ['required', 'boolean'],
        ])->validate();
        LibraryTransaction::run(function () use ($post, $data) {
            $post->update($data);
            ActivityService::record('post.updated', 'post', $post->id);
        });

        return response()->json($post);
    }

    /** DELETE /posts/{type}/{id} — librarian deletes */
    public function destroy(string $type, int $id): JsonResponse
    {
        $post = Post::where('type', $type)->findOrFail($id);
        LibraryTransaction::run(function () use ($post) {
            $post->delete();
            ActivityService::record('post.deleted', 'post', $post->id);
        });

        return response()->json(['message' => 'Post deleted.']);
    }
}
