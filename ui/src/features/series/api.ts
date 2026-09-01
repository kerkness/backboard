import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '../../lib/api'
import type { Series, SeriesDetail } from './types'
import type { SearchRun } from './searchTypes'

export function useSeriesIndex() {
  return useQuery({
    queryKey: ['series'],
    queryFn: ({ signal }) => apiGet<Series[]>('getIndex', {}, signal),
    staleTime: 60_000,
  })
}

export function useSeriesDetail(comicId: string | undefined) {
  return useQuery({
    queryKey: ['series', comicId],
    queryFn: ({ signal }) => apiGet<SeriesDetail>('getComic', { id: comicId! }, signal),
    enabled: Boolean(comicId),
  })
}

export interface SearchRunPage {
  runs: SearchRun[]
  total: number
  offset: number
  limit: number
}

export function useSearchRuns(
  comicId: string | undefined,
  opts: { limit?: number; offset?: number } = {},
) {
  const { limit = 10, offset = 0 } = opts
  return useQuery({
    queryKey: ['searchRuns', comicId, limit, offset],
    queryFn: ({ signal }) =>
      apiGet<SearchRunPage>('getSearchRuns', { comicid: comicId!, limit, offset }, signal),
    enabled: Boolean(comicId),
    placeholderData: (prev) => prev,
  })
}

/** Summary rows only (no candidates) for list views such as Activity. */
export function useRecentSearchRuns(opts: { limit?: number; offset?: number } = {}) {
  const { limit = 10, offset = 0 } = opts
  return useQuery({
    queryKey: ['searchRuns', 'recent', limit, offset],
    queryFn: ({ signal }) =>
      apiGet<SearchRunPage>('getSearchRuns', { limit, offset, summary: 1 }, signal),
    placeholderData: (prev) => prev,
    refetchInterval: 15_000,
  })
}

/**
 * Both triggers return as soon as the work is queued -- a run takes ~46s per issue at
 * the configured provider delay, so results arrive later via the audit tables.
 */
export function useStartSearch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: { scope: 'issue' | 'series'; id: string }) =>
      apiGet<{ queued: number; message: string }>(
        target.scope === 'issue' ? 'searchIssue' : 'searchSeries',
        { id: target.id },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['searchRuns'] })
      queryClient.invalidateQueries({ queryKey: ['series'] })
    },
  })
}

interface CandidateRef {
  runId: string
  seq: number
}

/** Downloads land staged in the candidate folder; nothing auto-processes them. */
export function useDownloadCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ runId, seq, oneoff }: CandidateRef & { oneoff?: boolean }) =>
      apiGet<{ message: string; pack: boolean }>('downloadCandidate', {
        run_id: runId,
        seq,
        oneoff: oneoff ? 1 : undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['searchRuns'] }),
  })
}

export function useIgnoreCandidate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ runId, seq, undo }: CandidateRef & { undo?: boolean }) =>
      apiGet<{ action: string | null }>('ignoreCandidate', {
        run_id: runId,
        seq,
        undo: undo ? 1 : undefined,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['searchRuns'] }),
  })
}

export interface CvMatch {
  comicid: string
  name: string
  comicyear: string
  publisher: string
  issues: string
  comicimage?: string
  haveit?: string | boolean
}

/** A posting title has no ComicVine id, so following it means picking a CV match. */
export function useLookupCandidate() {
  return useMutation({
    mutationFn: ({ runId, seq }: CandidateRef) =>
      apiGet<{ query: string; results: CvMatch[] }>('lookupCandidate', {
        run_id: runId,
        seq,
      }),
  })
}

export function useAddSeriesById() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (comicId: string) => apiGet<string>('addComic', { id: comicId, wantall: 1 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] }),
  })
}
