/**
 * Week maths for the pull list.
 *
 * The backend (`_weekOf` / `_getWeeklyPull` in mylar/api.py) keys weeks by
 * Python's `%U`: weeks run Sunday..Saturday, week 01 starts at the year's first
 * Sunday, and the days before it are week 00. Mylar never *stores* week 00 --
 * `_weekOf` maps those days back onto the previous year's last week -- so every
 * week we page through has a real Sunday, and stepping by Sundays is exact.
 *
 * Everything here works in UTC. Local-time date arithmetic drifts across DST
 * boundaries, and formatting a UTC midnight in a negative offset would render
 * the previous day.
 */

const DAY_MS = 86_400_000

/** Sunday that begins `%U` week `week` of `year`. */
export function weekStart(week: number, year: number): Date {
  const jan1 = new Date(Date.UTC(year, 0, 1))
  // Week 01 starts at the first Sunday; week 00 is the stub before it.
  const firstSunday = jan1.getTime() + ((7 - jan1.getUTCDay()) % 7) * DAY_MS
  if (week <= 0) return jan1
  return new Date(firstSunday + (week - 1) * 7 * DAY_MS)
}

/** The `%U` week/year a date falls in. */
export function weekOf(date: Date): { week: number; year: number } {
  const year = date.getUTCFullYear()
  const yday = Math.round((date.getTime() - Date.UTC(year, 0, 1)) / DAY_MS)
  // Python's %U, using the date's own weekday (Sunday = 0). Deriving it from
  // Jan 1's weekday instead is off by one in years that open on a Sunday.
  return { week: Math.floor((yday + 7 - date.getUTCDay()) / 7), year }
}

/**
 * Step `delta` weeks from a given week, crossing year boundaries correctly.
 *
 * Stepping through the actual Sunday is what makes the year boundary work: the
 * previous approximation round-tripped 2025-W52 -> 2026-W01 -> 2026-W00.
 */
export function shiftWeek(week: string, year: string, delta: number) {
  const start = weekStart(Number(week), Number(year))
  const moved = new Date(start.getTime() + delta * 7 * DAY_MS)
  const w = weekOf(moved)
  return { week: String(w.week).padStart(2, '0'), year: String(w.year) }
}

const md = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const mdy = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

/** e.g. `Aug 30 – Sep 5, 2026`, or `Dec 27, 2026 – Jan 2, 2027` across a year end. */
export function formatWeekRange(week: string, year: string): string {
  if (!week || !year) return ''
  const start = weekStart(Number(week), Number(year))
  const end = new Date(start.getTime() + 6 * DAY_MS)
  if (start.getUTCFullYear() !== end.getUTCFullYear()) {
    return `${mdy.format(start)} – ${mdy.format(end)}`
  }
  return `${md.format(start)} – ${mdy.format(end)}`
}
