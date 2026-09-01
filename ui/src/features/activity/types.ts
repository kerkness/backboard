/** Shapes from `_getActivity` in mylar/api.py. All times are epoch seconds. */

export interface QueueItem {
  comicid?: string | null
  issueid?: string | null
  comicname?: string | null
  issuenumber?: string | null
  seriesyear?: string | null
  booktype?: string | null
}

export interface QueueSnapshot {
  size: number
  items: QueueItem[]
  error?: string
}

export interface Job {
  name: string
  status: string | null
  last_run_completed: string | null
  prev_run: number | null
  next_run: number | null
  seconds_until: number | null
}

export interface Provider {
  provider: string
  type: string | null
  lastrun: number | null
  active: string | null
  hits: number | null
}

export interface RecentRun {
  run_id: string
  comicid: string | null
  issueid: string | null
  comicname: string | null
  issuenumber: string | null
  provider: string | null
  started: number
  finished: number | null
  status: string
  candidate_count: number
  accepted_count: number
}

export interface Activity {
  now: number
  queues: Record<'search' | 'ddl' | 'postprocess' | 'nzb', QueueSnapshot>
  ddl_status: Record<string, number>
  locks: { search: boolean; ddl: boolean }
  jobs: Job[]
  providers: Provider[]
  search_totals: { runs: number; candidates: number; accepted: number }
  recent_runs: RecentRun[]
}
