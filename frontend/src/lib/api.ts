/**
 * Thin fetch wrapper over the Django/DRF API. Vite proxies `/api` to
 * :8000 (see vite.config.ts), so requests are same-origin in dev.
 */

const BASE = '/api';

/** DRF's PageNumberPagination envelope (PAGE_SIZE = 25 in settings.py). */
interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export class ApiError extends Error {
  /** DRF returns `{field: [messages]}` -- kept intact so forms can show it. */
  constructor(
    message: string,
    readonly status: number,
    readonly detail: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new ApiError(errorMessage(detail, response.status), response.status, detail);
  }

  // 204 on DELETE has no body.
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

function errorMessage(detail: unknown, status: number): string {
  if (detail && typeof detail === 'object') {
    const [field, messages] = Object.entries(detail)[0] ?? [];
    if (field && Array.isArray(messages) && messages.length) {
      return field === 'non_field_errors' ? String(messages[0]) : `${field}: ${messages[0]}`;
    }
  }
  return `Request failed (${status})`;
}

/** Paginated endpoints return an envelope; everything downstream wants rows. */
async function list<T>(path: string): Promise<T[]> {
  const body = await request<Page<T> | T[]>(path);
  return Array.isArray(body) ? body : body.results;
}

function query(params: Record<string, string | undefined>): string {
  const pairs = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (!pairs.length) return '';
  return `?${new URLSearchParams(pairs as [string, string][]).toString()}`;
}

export const api = {
  list,
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
  query,
};
