/** Shapes returned by `_selectForComics` / `_selectForIssues` in mylar/api.py. */

export interface Series {
  id: string
  name: string
  imageURL: string | null
  status: string | null
  publisher: string | null
  publishYear: string | null
  year: string | null
  latestIssue: string | null
  latestDate: string | null
  haveIssues: number | null
  totalIssues: number | null
  bookType: string | null
  correctedBookType: string | null
  lastUpdated: string | null
  detailsURL: string | null
  alternateSearch: string | null
}

export interface Issue {
  id: string
  name: string | null
  imageURL: string | null
  number: string | null
  releaseDate: string | null
  issueDate: string | null
  status: string | null
  comicName: string | null
}

export interface SeriesDetail {
  comic: Series[]
  issues: Issue[]
  annuals: Issue[]
}
