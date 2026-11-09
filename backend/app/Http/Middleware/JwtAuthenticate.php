<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Tymon\JWTAuth\Exceptions\JWTException;
use Tymon\JWTAuth\Facades\JWTAuth as JWTAuthFacade;

class JwtAuthenticate
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            $user = JWTAuthFacade::parseToken()->authenticate();
            if (! $user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        } catch (JWTException) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return $next($request);
    }
}
