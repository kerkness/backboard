/** Shape returned by `_getWeeklyPull` in mylar/api.py. */

export interface WeeklyIssue {
  shipDate: string | null
  publisher: string | null
  issueNumber: string | null
  comicName: string | null
  status: string | null
  comicId: string | null
  issueId: string | null
  weekNumber: string
  year: string
  volume: string | null
  seriesYear: string | null
  format: string | null
  dynamicName: string | null
  /** Non-null only when the series is already on the watchlist. */
  watchedComicId: string | null
  watchedComicName: string | null
  seriesStatus: string | null
  imageURL: string | null
  /** ComicVine page for the series; only set when we already follow it. */
  detailsURL: string | null
}

export interface WeeklyPull {
  week: string
  year: string
  issues: WeeklyIssue[]
}
