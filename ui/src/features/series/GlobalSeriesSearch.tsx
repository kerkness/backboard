import { useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TravelExploreIcon from '@mui/icons-material/TravelExplore'
import { ImageLightbox } from '../../components/ImageLightbox'
import { pullCoverUrl } from '../../lib/api'
import { useToast } from '../../app/ToastProvider'
import { useAddSeriesById, useFindSeries } from './api'
import type { CvMatch } from './api'
import { SeriesMatchRow } from './SeriesMatchRow'

/**
 * Search ComicVine for series that aren't on the watchlist yet.
 *
 * Sits under the watchlist results: the local list answers "do I already follow
 * this?" for free, and this answers "does it exist?" for one ComicVine call.
 * It is on a button rather than firing with the query because pullsearch sleeps
 * >=2s per call against a ~200/hour budget.
 */
export function GlobalSeriesSearch({ query, auto }: { query: string; auto?: boolean }) {
  const find = useFindSeries()
  const addSeries = useAddSeriesById()
  const toast = useToast()
  const [pending, setPending] = useState<string | null>(null)
  const [zoom, setZoom] = useState<CvMatch | null>(null)
  // Covers are queued by the search itself, so retry the ones that missed.
  const [epoch, setEpoch] = useState(0)

  // A new query invalidates the previous results rather than leaving them under
  // a search term that no longer produced them. When the search bar was scoped to
  // ComicVine, that choice *is* the instruction to search, so run it here.
  useEffect(() => {
    find.reset()
    setEpoch(0)
    if (auto && query) find.mutate(query)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, auto])

  useEffect(() => {
    if (!find.data?.length) return
    const timers = [3_000, 9_000].map((ms) => setTimeout(() => setEpoch((n) => n + 1), ms))
    return () => timers.forEach(clearTimeout)
  }, [find.data])

  const add = (r: CvMatch) => {
    setPending(r.comicid)
    addSeries.mutate(r.comicid, {
      onSuccess: () => {
        toast(`Adding ${r.name}. All issues wanted.`, 'success')
        setPending(null)
      },
      onError: (e) => {
        toast((e as Error).message, 'error')
        setPending(null)
      },
    })
  }

  if (!query) return null

  const results = find.data ?? []

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Looking for something you don’t follow yet?
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={find.isPending ? <CircularProgress size={14} /> : <TravelExploreIcon />}
          disabled={find.isPending}
          onClick={() => find.mutate(query)}
          sx={{ ml: 'auto' }}
        >
          {find.isPending ? 'Searching…' : 'Search ComicVine'}
        </Button>
      </Stack>

      {!find.isPending && !find.data && !find.isError && (
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5 }}>
          Searches ComicVine’s catalogue for “{query}”. One lookup per press. ComicVine
          rate-limits, so this doesn’t run as you type.
        </Typography>
      )}

      {find.isError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {(find.error as Error).message}
        </Alert>
      )}

      {find.data && results.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
          ComicVine has no series matching “{query}”.
        </Typography>
      )}

      {results.length > 0 && (
        <>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
            {results.length} match{results.length === 1 ? '' : 'es'} on ComicVine
          </Typography>
          <Stack divider={<Divider />} sx={{ mt: 0.5 }}>
            {results.slice(0, 25).map((r) => (
              <SeriesMatchRow
                key={r.comicid}
                match={r}
                epoch={epoch}
                adding={pending === r.comicid}
                disabled={addSeries.isPending}
                onAdd={add}
                onZoom={setZoom}
              />
            ))}
          </Stack>
        </>
      )}

      <ImageLightbox
        src={zoom ? pullCoverUrl(null, zoom.comicid, epoch, 'zoom') : null}
        alt={zoom?.name ?? ''}
        onClose={() => setZoom(null)}
      />
    </Paper>
  )
}
