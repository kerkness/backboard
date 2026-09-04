import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet } from '../../lib/api'
import type { WeeklyPull } from './types'

export function useWeeklyPull(week?: string, year?: string) {
  return useQuery({
    queryKey: ['weekly', week ?? 'current', year ?? 'current'],
    queryFn: ({ signal }) => apiGet<WeeklyPull>('getWeeklyPull', { week, year }, signal),
    staleTime: 60_000,
  })
}

/**
 * DESIGN.md: adding a series from this UI always marks every issue Wanted, so
 * `wantall` is always set. addComic queues the add in a background thread, so the
 * watchlist won't reflect it immediately.
 */
export function useAddSeries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (comicId: string) => apiGet<string>('addComic', { id: comicId, wantall: 1 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series'] })
      queryClient.invalidateQueries({ queryKey: ['weekly'] })
    },
  })
}

export interface PrefetchResult {
  /** Rows in this week that still have no cached cover. */
  pending: number
  /** False when nothing needed fetching, or a fetch for this week is already running. */
  started: boolean
}

/**
 * Warm the cover cache for a week.
 *
 * The server resolves the whole week in one or two ComicVine calls and downloads
 * the art from CV's CDN, which isn't rate limited. Covers land asynchronously, so
 * callers re-request the images a few times after this resolves.
 */
export function usePrefetchPullCovers() {
  return useMutation({
    mutationFn: ({ week, year }: { week: string; year: string }) =>
      apiGet<PrefetchResult>('prefetchPullCovers', { week, year }),
  })
}
