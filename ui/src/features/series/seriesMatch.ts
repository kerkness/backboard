import type { CvMatch } from './api'

/**
 * ComicVine tells us whether a match is already on the watchlist, but not as a
 * boolean: `haveit` is the literal string 'No' when absent, and the library row
 * ({comicid, status}) when present. Anything that isn't 'No' means we have it.
 */
export const alreadyHave = (r: CvMatch) => Boolean(r.haveit) && r.haveit !== 'No'
