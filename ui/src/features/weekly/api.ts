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
