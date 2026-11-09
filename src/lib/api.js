/**
 * Thin HTTP client for the Laravel REST API.
 * Base URL is read from the VITE_API_URL env var (fallback: http://localhost:8000/api/v1).
 */

export const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");

const TOKEN_KEY = "amg_jwt";

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
}

/**
 * Core fetch wrapper. Throws an Error with a user-friendly message on non-2xx.
 */
export async function apiFetch(path, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };

    if (token) headers["Authorization"] = "Bearer " + token;

    // Don't set Content-Type for FormData — browser sets multipart boundary automatically
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
        headers["Accept"] = "application/json";
    } else {
        headers["Accept"] = "application/json";
    }

    const res = await fetch(API_BASE + path, { ...options, headers });

    if (res.status === 204) return null;

    let data;
    try {
        data = await res.json();
    } catch {
        if (!res.ok) throw new Error("Request failed (" + res.status + ")");
        return null;
    }

    if (!res.ok) {
        const msg = data?.message || "Request failed (" + res.status + ")";
        const err = new Error(msg);
        err.status = res.status;
        err.errors = data?.errors || null;
        throw err;
    }

    return data;
}

// ── Convenience methods ───────────────────────────────────────────────────────

export const api = {
    get: (path) => apiFetch(path, { method: "GET" }),
    post: (path, body) => apiFetch(path, { method: "POST", body: body instanceof FormData ? body : JSON.stringify(body) }),
    patch: (path, body) => apiFetch(path, { method: "PATCH", body: JSON.stringify(body) }),
    put: (path, body) => apiFetch(path, { method: "PUT", body: JSON.stringify(body) }),
    delete: (path) => apiFetch(path, { method: "DELETE" }),
};
