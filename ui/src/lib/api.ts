/**
 * Client for Mylar's JSON API (`mylar/api.py`).
 *
 * Every command goes through GET /api?apikey=..&cmd=.. — there is no REST shape to
 * lean on. Most commands wrap their payload in {success, data}, but a few older ones
 * (getUpcoming, getWanted) return a bare array, so unwrap() handles both.
 */

const API_KEY = import.meta.env.VITE_MYLAR_API_KEY ?? ''

// Same origin in production (served from /ui); the Vite dev server proxies /api.
const API_BASE = '/api'

export class ApiError extends Error {
  readonly code?: number

  constructor(message: string, code?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

interface Envelope<T> {
  success: boolean
  data?: T
  error?: { code: number; message: string }
}

function isEnvelope<T>(body: unknown): body is Envelope<T> {
  return typeof body === 'object' && body !== null && 'success' in body
}

export function apiUrl(cmd: string, params: Record<string, string | number | undefined> = {}) {
  const search = new URLSearchParams({ apikey: API_KEY, cmd })
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  }
  return `${API_BASE}?${search.toString()}`
}

export async function apiGet<T>(
  cmd: string,
  params: Record<string, string | number | undefined> = {},
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(apiUrl(cmd, params), { signal })
  if (!res.ok) throw new ApiError(`${cmd} failed (HTTP ${res.status})`, res.status)

  const body = await res.json()
  if (isEnvelope<T>(body)) {
    if (!body.success) {
      throw new ApiError(body.error?.message ?? `${cmd} failed`, body.error?.code)
    }
    return body.data as T
  }
  return body as T
}

/** Cover art, served by Mylar from its own cache rather than hotlinked from ComicVine. */
export const comicArtUrl = (comicId: string) => apiUrl('getArt', { id: comicId })

/** First page of a staged comic archive, extracted and cached server-side. */
export const fileCoverUrl = (path: string) => apiUrl('getFileCover', { path })

/**
 * Cover art for a pull-list row, served from Mylar's cache.
 *
 * Cache-only on the server: a row with no cover yet returns an error rather than
 * blocking on ComicVine, so callers should handle the image failing to load.
 * `epoch` busts the browser cache after a prefetch lands new art.
 */
export const pullCoverUrl = (
  issueId: string | null,
  comicId: string | null,
  epoch = 0,
  size: 'thumb' | 'zoom' = 'thumb',
) =>
  apiUrl('getPullCover', {
    issueid: issueId ?? undefined,
    comicid: comicId ?? undefined,
    size: size === 'thumb' ? undefined : size,
    v: epoch || undefined,
  })
