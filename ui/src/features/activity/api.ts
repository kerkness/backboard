import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../lib/api'
import type { Activity } from './types'

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: ({ signal }) => apiGet<Activity>('getActivity', {}, signal),
    // Queue depth and countdowns are only useful if they move.
    refetchInterval: 10_000,
  })
}
