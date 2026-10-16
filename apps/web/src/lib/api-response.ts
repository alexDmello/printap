import { NextResponse } from "next/server";

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
}

/**
 * Returns a standardized success JSON response.
 */
export function apiSuccess<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status, headers }
  );
}

/**
 * Returns a standardized client or domain error response.
 */
export function apiError(
  error: string,
  status = 400,
  code?: string,
  details?: unknown,
  headers?: HeadersInit
) {
  return NextResponse.json(
    {
      success: false,
      error,
      ...(code ? { code } : {}),
      ...(details ? { details } : {}),
    },
    { status, headers }
  );
}

export function apiUnauthorized(message = "Unauthorized", code = "UNAUTHORIZED") {
  return apiError(message, 401, code);
}

export function apiForbidden(message = "Forbidden", code = "FORBIDDEN") {
  return apiError(message, 403, code);
}

export function apiNotFound(message = "Resource not found", code = "NOT_FOUND") {
  return apiError(message, 404, code);
}

/**
 * Handles unexpected server errors. Logs the raw error on the server
 * and returns a safe, sanitized message to the client (no stack/internal leakage).
 */
export function apiServerError(err: unknown, context = "API") {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${context}] Internal Exception:`, err);

  return apiError(
    process.env.NODE_ENV === "production"
      ? "An unexpected internal server error occurred."
      : `Internal error: ${message}`,
    500,
    "INTERNAL_SERVER_ERROR"
  );
}
