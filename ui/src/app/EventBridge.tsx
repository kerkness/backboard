import { useQueryClient } from '@tanstack/react-query'
import { useMylarEvents } from '../lib/events'
import { useToast } from './ToastProvider'

/**
 * Turns Mylar's server-sent events into toasts and cache invalidations.
 *
 * Adding a series runs on a background thread, so the HTTP response only says
 * "queued" — the actual result arrives here. Invalidating on `addbyid` is what makes
 * a newly added series appear without a refresh.
 */
export function EventBridge() {
  const toast = useToast()
  const queryClient = useQueryClient()

  useMylarEvents((e) => {
    switch (e.event) {
      case 'addbyid': {
        const name = e.comicname
          ? `${e.comicname}${e.seriesyear ? ` (${e.seriesyear})` : ''}`
          : 'Series'
        if (e.status === 'complete' || e.status === 'success') {
          toast(`${name} added.`, 'success')
        } else if (e.status === 'failure' || e.status === 'error') {
          toast(e.message || `${name} could not be added.`, 'error')
        } else if (e.message) {
          toast(e.message, 'info')
        }
        queryClient.invalidateQueries({ queryKey: ['series'] })
        queryClient.invalidateQueries({ queryKey: ['weekly'] })
        break
      }
      case 'scheduler_message':
        // Searches and downloads report progress through here; a finished search
        // means the audit rows for it now exist.
        if (e.message) toast(e.message, e.status === 'failure' ? 'error' : 'info')
        queryClient.invalidateQueries({ queryKey: ['searchRuns'] })
        break
      default:
        if (e.message) toast(e.message, e.status === 'failure' ? 'error' : 'info')
    }
  })

  return null
}
