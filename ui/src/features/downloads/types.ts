/** Shapes from `_getDownloads` in mylar/api.py. */

export interface PpFile {
  filename: string | null
  outcome: 'filed' | 'duplicate' | 'failed'
  detail: string | null
  issuenumber: string | null
}

export interface PostProcessResult {
  pp_id: string
  nzb_name: string | null
  started: number
  finished: number | null
  files_total: number
  filed_count: number
  duplicate_count: number
  failed_count: number
  files: PpFile[]
}

export interface Download {
  id: string
  series: string | null
  year: string | null
  filename: string | null
  size: string | null
  remote_filesize: string | null
  status: string
  link_type: string | null
  site: string | null
  issueid: string | null
  comicid: string | null
  pack: number | null
  /** Issue range the posting advertised — not always what it delivered. */
  issues: string | null
  updated_date: string | null
  percent: number | null
  postprocess: PostProcessResult | null
  /** Set when a pack satisfied nothing because every file was already owned. */
  warning: string | null
}

export interface DownloadPage {
  downloads: Download[]
  total: number
  offset: number
  limit: number
}

export interface StagedContent {
  name: string
  path: string
  size: number
}

export interface StagedFile {
  name: string
  path: string
  root: string
  is_dir: boolean
  size: number
  modified: number
  contents: StagedContent[]
}
