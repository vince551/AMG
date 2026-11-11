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
            if (! $user || ! $user->is_active || (int) JWTAuthFacade::getPayload()->get('ver', 0) !== (int) $user->token_version) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        } catch (JWTException) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($user->must_change_password && ! $request->is('api/v1/auth/me', 'api/v1/auth/password', 'api/v1/auth/logout')) {
            return response()->json(['message' => 'Change your temporary password before continuing.', 'code' => 'password_change_required'], 403);
        }

        $response = $next($request);
        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }
}
