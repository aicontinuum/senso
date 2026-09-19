// The one way a client component calls an admin API route. Every route
// answers JSON with either the payload or `{ error }`; this folds the
// transport and the parsing into a result the component can branch on
// without a try/catch of its own.

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

const FALLBACK_ERROR = 'Something went wrong. Please try again.';

export async function callApi<T = unknown>(
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : FALLBACK_ERROR;
      return { ok: false, error: message };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: FALLBACK_ERROR };
  }
}
