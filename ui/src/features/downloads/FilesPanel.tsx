import { useMemo, useState } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Autocomplete from '@mui/material/Autocomplete'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { fileCoverUrl } from '../../lib/api'
import { FileCover } from '../../components/FileCover'
import { ImageLightbox } from '../../components/ImageLightbox'
import { useToast } from '../../app/ToastProvider'
import { useSeriesIndex, useSeriesDetail } from '../series/api'
import { useDeleteStagedFile, useMatchStagedFile, useStagedFiles } from './api'
import type { StagedFile } from './types'
import { isLeftover } from './staged'

const human = (n: number) => {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}

/** Pick the issue a file actually is, then let Mylar file it. */
function MatchDialog({
  path,
  name,
  onClose,
}: {
  path: string | null
  name: string
  onClose: () => void
}) {
  const [comicId, setComicId] = useState<string | null>(null)
  const { data: series } = useSeriesIndex()
  const { data: detail } = useSeriesDetail(comicId ?? undefined)
  const match = useMatchStagedFile()
  const toast = useToast()

  const issues = useMemo(() => detail?.issues ?? [], [detail])

  return (
    <Dialog open={Boolean(path)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        Match file
        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
          {name}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Autocomplete
            options={series ?? []}
            getOptionLabel={(o) => `${o.name} (${o.year ?? '?'})`}
            onChange={(_, v) => setComicId(v?.id ?? null)}
            renderInput={(params) => <TextField {...params} label="Series" size="small" />}
          />
          <Autocomplete
            options={issues}
            disabled={!comicId}
            getOptionLabel={(o) => `#${o.number} ${o.name ?? ''} (${o.status})`}
            onChange={(_, v) => {
              if (!v || !path) return
              match.mutate(
                { path, issueid: v.id },
                {
                  onSuccess: (r) => {
                    toast(r.message, 'success')
                    onClose()
                  },
                  onError: (e) => toast((e as Error).message, 'error'),
                },
              )
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label={comicId ? 'Issue (choosing one starts the match)' : 'Pick a series first'}
                size="small"
              />
            )}
          />
          {match.isPending && <CircularProgress size={20} />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  )
}

function FileRow({
  f,
  onMatch,
  onZoom,
}: {
  f: StagedFile
  onMatch: (path: string, name: string) => void
  onZoom: (path: string) => void
}) {
  const del = useDeleteStagedFile()
  const toast = useToast()

  return (
    <Accordion disableGutters variant="outlined">
      <AccordionSummary expandIcon={f.contents.length ? <ExpandMoreIcon /> : null}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
          {!f.is_dir && (
            <FileCover
              path={f.path}
              width={36}
              onClick={(e) => {
                e.stopPropagation()
                onZoom(f.path)
              }}
            />
          )}
          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
            {f.name}
          </Typography>
          {f.is_dir && <Chip size="small" variant="outlined" label={`${f.contents.length} files`} />}
          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
            {human(f.size)} · {new Date(f.modified * 1000).toLocaleString()}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          {!f.is_dir && (
            <Button size="small" variant="outlined" onClick={() => onMatch(f.path, f.name)}>
              Match to issue…
            </Button>
          )}
          <Button
            size="small"
            color="error"
            disabled={del.isPending}
            onClick={() =>
              del.mutate(f.path, {
                onSuccess: () => toast(`Deleted ${f.name}`, 'success'),
                onError: (e) => toast((e as Error).message, 'error'),
              })
            }
          >
            Delete
          </Button>
        </Stack>
        <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
          {f.path}
        </Typography>
        {f.contents.length > 0 && (
          <Stack divider={<Divider />} sx={{ mt: 1.5 }}>
            {f.contents.map((c) => (
              <Stack
                key={c.path}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', py: 0.5 }}
              >
                <FileCover path={c.path} width={36} onClick={() => onZoom(c.path)} />
                <Typography variant="body2" sx={{ minWidth: 0, flex: 1 }} noWrap>
                  {c.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {human(c.size)}
                </Typography>
                <Button size="small" onClick={() => onMatch(c.path, c.name)}>
                  Match
                </Button>
              </Stack>
            ))}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  )
}

function LeftoverRow({ f, onDelete }: { f: StagedFile; onDelete: (path: string) => void }) {
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', py: 0.25, pl: 1 }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 0, flex: 1 }} noWrap>
        {f.name}
      </Typography>
      <Button size="small" color="inherit" onClick={() => onDelete(f.path)}>
        Remove
      </Button>
    </Stack>
  )
}

export function FilesPanel() {
  const { data, isLoading, error } = useStagedFiles()
  const [target, setTarget] = useState<{ path: string; name: string } | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const del = useDeleteStagedFile()

  if (error) return <Alert severity="error">{(error as Error).message}</Alert>
  if (isLoading) return <CircularProgress size={20} />

  const all = data?.files ?? []
  const unmatched = all.filter((f) => !isLeftover(f))
  const leftovers = all.filter(isLeftover)

  return (
    <Stack spacing={1.5}>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Files on disk that no issue has claimed. Matching one tells Mylar which issue it is,
        and files it accordingly.
      </Typography>

      {unmatched.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nothing waiting to be matched.
        </Typography>
      )}

      {unmatched.map((f) => (
        <FileRow
          key={f.path}
          f={f}
          onMatch={(path, name) => setTarget({ path, name })}
          onZoom={setZoom}
        />
      ))}

      {leftovers.length > 0 && (
        <Accordion disableGutters variant="outlined">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {leftovers.length} empty folder{leftovers.length === 1 ? '' : 's'} left over from
              post-processing
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              These contain no files. Their contents were already filed into your library.
              Removing one deletes just the empty folder.
            </Typography>
            <Stack sx={{ mt: 1 }} divider={<Divider />}>
              {leftovers.map((f) => (
                <LeftoverRow key={f.path} f={f} onDelete={(path) => del.mutate(path)} />
              ))}
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}

      <MatchDialog
        path={target?.path ?? null}
        name={target?.name ?? ''}
        onClose={() => setTarget(null)}
      />

      <ImageLightbox
        src={zoom ? fileCoverUrl(zoom) : null}
        onClose={() => setZoom(null)}
      />
    </Stack>
  )
}
