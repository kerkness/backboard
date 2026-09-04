import { useEffect, useState } from 'react'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import IconButton from '@mui/material/IconButton'
import { useToast } from '../../app/ToastProvider'
import {
  useAddSeriesById,
  useDownloadCandidate,
  useIgnoreCandidate,
  useLookupCandidate,
} from './api'
import type { CvMatch } from './api'
import type { SearchCandidate } from './searchTypes'
import { ImageLightbox } from '../../components/ImageLightbox'
import { SeriesMatchRow } from './SeriesMatchRow'
import { pullCoverUrl } from '../../lib/api'

const ACTION_LABEL: Record<string, string> = {
  ignored: 'Ignored',
  downloading: 'Downloading',
  downloaded: 'Staged',
  failed: 'Failed',
}

/**
 * Series picker — a posting title carries no ComicVine id, so the user chooses.
 *
 * Adding a series is not undoable in one click, so it is an explicit button
 * rather than a click anywhere on the row; the row itself stays inert and the
 * cover is a zoom target.
 */
function LookupDialog({
  open,
  onClose,
  query,
  results,
  loading,
}: {
  open: boolean
  onClose: () => void
  query: string
  results: CvMatch[]
  loading: boolean
}) {
  const addSeries = useAddSeriesById()
  const toast = useToast()
  const [pending, setPending] = useState<string | null>(null)
  const [zoom, setZoom] = useState<CvMatch | null>(null)
  // Covers are fetched by the lookup itself, so give late arrivals a retry.
  const [epoch, setEpoch] = useState(0)

  useEffect(() => {
    if (!open || results.length === 0) return
    const timers = [3_000, 9_000].map((ms) => setTimeout(() => setEpoch((n) => n + 1), ms))
    return () => timers.forEach(clearTimeout)
  }, [open, results.length])

  const add = (r: CvMatch) => {
    setPending(r.comicid)
    addSeries.mutate(r.comicid, {
      onSuccess: () => {
        toast(`Adding ${r.name}. All issues wanted.`, 'success')
        setPending(null)
        onClose()
      },
      onError: (e) => {
        toast((e as Error).message, 'error')
        setPending(null)
      },
    })
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Find series
        {query && (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            ComicVine matches for “{query}”
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        {loading && <CircularProgress size={20} />}
        {!loading && results.length === 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No ComicVine series matched that title.
          </Typography>
        )}
        <Stack divider={<Divider />}>
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
      </DialogContent>

      <ImageLightbox
        src={zoom ? pullCoverUrl(null, zoom.comicid, epoch, 'zoom') : null}
        alt={zoom?.name ?? ''}
        onClose={() => setZoom(null)}
      />
    </Dialog>
  )
}

export function CandidateActions({ c }: { c: SearchCandidate }) {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const [lookupOpen, setLookupOpen] = useState(false)
  const download = useDownloadCandidate()
  const ignore = useIgnoreCandidate()
  const lookup = useLookupCandidate()
  const toast = useToast()

  const ref = { runId: c.run_id, seq: c.seq }
  const close = () => setAnchor(null)

  const doDownload = (oneoff: boolean) => {
    close()
    download.mutate(
      { ...ref, oneoff },
      {
        onSuccess: (r) => toast(r.message, 'success'),
        onError: (e) => toast((e as Error).message, 'error'),
      },
    )
  }

  const doLookup = () => {
    close()
    setLookupOpen(true)
    lookup.mutate(ref, {
      onError: (e) => {
        toast((e as Error).message, 'error')
        setLookupOpen(false)
      },
    })
  }

  const doIgnore = (undo: boolean) => {
    close()
    ignore.mutate({ ...ref, undo })
  }

  const busy = download.isPending || ignore.isPending

  return (
    <>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexShrink: 0 }}>
        {c.action && (
          <Chip
            size="small"
            variant="outlined"
            color={c.action === 'failed' ? 'error' : c.action === 'downloaded' ? 'success' : 'default'}
            label={ACTION_LABEL[c.action] ?? c.action}
          />
        )}
        <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)} disabled={busy}>
          {busy ? <CircularProgress size={16} /> : <MoreVertIcon fontSize="small" />}
        </IconButton>
      </Stack>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        <MenuItem onClick={() => doDownload(false)} disabled={!c.link}>
          {c.pack ? 'Download pack' : 'Download'}
        </MenuItem>
        <MenuItem onClick={() => doDownload(true)} disabled={!c.link}>
          Download as one-shot
        </MenuItem>
        <MenuItem onClick={doLookup}>Find series…</MenuItem>
        <Divider />
        {c.action === 'ignored' ? (
          <MenuItem onClick={() => doIgnore(true)}>Un-ignore</MenuItem>
        ) : (
          <MenuItem onClick={() => doIgnore(false)}>Ignore</MenuItem>
        )}
      </Menu>

      <LookupDialog
        open={lookupOpen}
        onClose={() => setLookupOpen(false)}
        query={lookup.data?.query ?? ''}
        results={lookup.data?.results ?? []}
        loading={lookup.isPending}
      />
    </>
  )
}
