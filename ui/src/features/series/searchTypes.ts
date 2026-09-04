/** Shapes from `_getSearchRuns` in mylar/api.py, recorded by mylar/search_audit.py. */

export interface SearchCandidate {
  run_id: string
  seq: number
  /** Which of the query shapes surfaced this result. */
  queryline: string | null
  title: string | null
  link: string | null
  size: string | null
  year: string | null
  issues: string | null
  pack: number
  verdict: 'accepted' | 'rejected' | 'pending'
  reason: string | null
  detail: string | null
  /** What the user chose to do with it, if anything. */
  action: 'ignored' | 'downloading' | 'downloaded' | 'failed' | null
  action_detail: string | null
  ddl_id: string | null
}

export interface SearchRun {
  run_id: string
  comicid: string | null
  issueid: string | null
  comicname: string | null
  issuenumber: string | null
  seriesyear: string | null
  booktype: string | null
  provider: string | null
  started: number
  finished: number | null
  status: string
  /** Every query string actually sent to the provider, in order. */
  queries: string[]
  candidate_count: number
  accepted_count: number
  error: string | null
  candidates: SearchCandidate[]
}

/** Rejection codes from search_filer._reject(), mapped to something readable. */
export const REASON_LABELS: Record<string, string> = {
  ignored_word: 'Matched an ignore word',
  size_below_min: 'Below minimum size',
  size_above_max: 'Above maximum size',
  covers_only: 'Covers only',
  invalid_date: 'Unreadable issue date',
  invalid_store_date: 'Unusable store date',
  unparseable_post_date: 'Unreadable posting date',
  before_store_date: 'Posted before store date',
  parse_error: 'Filename parser failed',
  series_name_mismatch: 'Series name did not match',
  booktype_mismatch: 'Wrong book type',
  unparseable_title: 'Could not parse title',
  year_mismatch: 'Year did not match',
  version_mismatch: 'Volume did not match',
  issue_not_in_pack: 'Issue not in pack',
  pack_range_error: 'Unreadable pack range',
  issue_number_mismatch: 'Issue number did not match',
}

export const reasonLabel = (reason: string | null) =>
  reason ? (REASON_LABELS[reason] ?? reason) : 'Rejected'

/** Shapes from `_getSeriesFiles` — on-disk files paired with the issues they look like. */
export interface SeriesFile {
  name: string
  path: string
  size: number
  issue_number: number | null
  suggested_issueid: string | null
  suggested_status: string | null
}

export interface SeriesDownload {
  id: string
  series: string | null
  filename: string | null
  size: string | null
  status: string
  link_type: string | null
  pack: number | null
  issues: string | null
  updated_date: string | null
}

export interface SeriesFilesPayload {
  comicid: string
  comicname: string
  issues: { id: string; number: string; name: string | null; status: string }[]
  downloads: SeriesDownload[]
  files: SeriesFile[]
}
