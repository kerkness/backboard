import { useState } from 'react'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import ListItemButton from '@mui/material/ListItemButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
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

const ACTION_LABEL: Record<string, string> = {
  ignored: 'Ignored',
  downloading: 'Downloading',
  downloaded: 'Staged',
  failed: 'Failed',
}

/** ComicVine picker — a posting title carries no CV id, so the user chooses. */
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

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        ComicVine matches
        {query && (
          <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
            searched for “{query}”
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
            <ListItemButton
              key={r.comicid}
              disabled={addSeries.isPending}
              onClick={() =>
                addSeries.mutate(r.comicid, {
                  onSuccess: () => {
                    toast(`Adding ${r.name} — all issues wanted.`, 'success')
                    onClose()
                  },
                  onError: (e) => toast((e as Error).message, 'error'),
                })
              }
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {r.name} ({r.comicyear})
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {[r.publisher, r.issues ? `${r.issues} issues` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </Typography>
              </Box>
            </ListItemButton>
          ))}
        </Stack>
      </DialogContent>
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
        <MenuItem onClick={doLookup}>Find on ComicVine…</MenuItem>
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
