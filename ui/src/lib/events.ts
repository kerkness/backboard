import { useEffect, useRef } from 'react'
import { apiUrl } from './api'

/**
 * Mylar's push channel.
 *
 * `checkGlobalMessages` is a text/event-stream endpoint fed by `mylar.GLOBAL_MESSAGES`.
 * Named events carry their own payload shape; `addbyid` is the one that matters here,
 * since adding a series happens on a background thread and only reports back this way.
 */
export interface MylarEvent {
  event: string
  status?: string
  message?: string
  comicid?: string
  comicname?: string
  seriesyear?: string
  tables?: string
}

const EVENTS = ['addbyid', 'scheduler_message', 'config_check', 'check_update'] as const

export function useMylarEvents(onEvent: (e: MylarEvent) => void) {
  // Keep the callback in a ref so a re-render doesn't tear down the stream.
  const handler = useRef(onEvent)
  handler.current = onEvent

  useEffect(() => {
    const source = new EventSource(apiUrl('checkGlobalMessages'))

    const listeners = EVENTS.map((name) => {
      const fn = (e: Event) => {
        const raw = (e as MessageEvent).data
        if (!raw) return
        try {
          handler.current({ event: name, ...JSON.parse(raw) })
        } catch {
          // The server hand-builds this SSE payload as a string, so a malformed
          // frame is possible. Surface the text rather than dropping it.
          handler.current({ event: name, message: String(raw) })
        }
      }
      source.addEventListener(name, fn)
      return [name, fn] as const
    })

    return () => {
      listeners.forEach(([name, fn]) => source.removeEventListener(name, fn))
      source.close()
    }
  }, [])
}
