import type { StagedFile } from './types'

/**
 * An empty folder is post-processing litter, not something to match.
 *
 * Mylar leaves the download folder behind after filing its contents into the
 * library, so a completed pack appears here as a directory with nothing in it —
 * "Motor Girl 001-010 [__556546__]" is empty because all 10 issues filed fine.
 * Listing those as unmatched invites you to match files that no longer exist.
 */
export const isLeftover = (f: StagedFile) => f.is_dir && f.contents.length === 0
