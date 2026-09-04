import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../lib/api'
import type { DownloadPage } from './types'

export function useDownloads(
  opts: { limit?: number; offset?: number; status?: string; enabled?: boolean } = {},
) {
  const { limit = 20, offset = 0, status, enabled = true } = opts
  return useQuery({
    queryKey: ['downloads', limit, offset, status],
    queryFn: ({ signal }) => apiGet<DownloadPage>('getDownloads', { limit, offset, status }, signal),
    placeholderData: (prev) => prev,
    // The Unmatched tab reads staged files instead, so don't poll downloads there.
    enabled,
    // In-flight transfers only look alive if the numbers move.
    refetchInterval: 10_000,
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { StagedFile } from './types'

export function useStagedFiles() {
  return useQuery({
    queryKey: ['stagedFiles'],
    queryFn: ({ signal }) =>
      apiGet<{ files: StagedFile[]; roots: string[] }>('getStagedFiles', {}, signal),
  })
}

/** Assert which issue a file is; Mylar files and renames it accordingly. */
export function useMatchStagedFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ path, issueid }: { path: string; issueid: string }) =>
      apiGet<{ message: string }>('matchStagedFile', { path, issueid }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stagedFiles'] })
      queryClient.invalidateQueries({ queryKey: ['series'] })
    },
  })
}

export function useDeleteStagedFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (path: string) => apiGet<{ deleted: string }>('deleteStagedFile', { path }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['stagedFiles'] }),
  })
}
