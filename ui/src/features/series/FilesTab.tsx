import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { FileCover } from '../../components/FileCover'
import { fileCoverUrl } from '../../lib/api'
import { ImageLightbox } from '../../components/ImageLightbox'
import { useToast } from '../../app/ToastProvider'
import { useMatchStagedFile } from '../downloads/api'
import { useSeriesFiles } from './api'
import type { SeriesFile } from './searchTypes'
import { StatusChip } from './StatusChip'

const human = (n: number) => {
  if (!n) return '0 B'
  const u = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
  return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`
}

function FileRow({
  f,
  onMatched,
  onZoom,
}: {
  f: SeriesFile
  onMatched: () => void
  onZoom: (path: string) => void
}) {
  const match = useMatchStagedFile()
  const toast = useToast()

  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{ alignItems: 'center', py: 0.75, flexWrap: 'wrap' }}
    >
      <FileCover path={f.path} width={44} onClick={() => onZoom(f.path)} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap>
          {f.name}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {human(f.size)}
          {f.issue_number !== null ? ` · looks like issue #${f.issue_number}` : ' · no issue number read'}
        </Typography>
      </Box>

      {f.suggested_status && <StatusChip status={f.suggested_status} />}

      {f.suggested_issueid ? (
        <Button
          size="small"
          variant="outlined"
          disabled={match.isPending}
          onClick={() =>
            match.mutate(
              { path: f.path, issueid: f.suggested_issueid! },
              {
                onSuccess: (r) => {
                  toast(r.message, 'success')
                  onMatched()
                },
                onError: (e) => toast((e as Error).message, 'error'),
              },
            )
          }
        >
          {match.isPending ? <CircularProgress size={14} /> : `Match #${f.issue_number}`}
        </Button>
      ) : (
        <Chip size="small" variant="outlined" label="no match" />
      )}
    </Stack>
  )
}

export function FilesTab({ comicId }: { comicId: string }) {
  const { data, isLoading, error, refetch } = useSeriesFiles(comicId)
  const [zoom, setZoom] = useState<string | null>(null)

  if (error) return <Alert severity="error">{(error as Error).message}</Alert>
  if (isLoading || !data) return <CircularProgress size={20} />

  const stuck = data.issues.filter((i) => i.status === 'Snatched')

  return (
    <Stack spacing={2}>
      {stuck.length > 0 && (
        <Alert severity="warning">
          {stuck.length} issue{stuck.length > 1 ? 's are' : ' is'} marked Snatched but never
          arrived: {stuck.map((i) => `#${i.number}`).join(', ')}. If a file below matches one,
          matching it will file it and clear the status.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h2" sx={{ mb: 1 }}>
          Files on disk ({data.files.length})
        </Typography>
        {data.files.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Nothing on disk looks like this series.
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {data.files.map((f) => (
              <FileRow key={f.path} f={f} onMatched={() => refetch()} onZoom={setZoom} />
            ))}
          </Stack>
        )}
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="h2" sx={{ mb: 1 }}>
          Downloads ({data.downloads.length})
        </Typography>
        {data.downloads.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No downloads recorded against this series.
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {data.downloads.map((d) => (
              <Stack
                key={d.id}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', py: 0.75, flexWrap: 'wrap' }}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" noWrap>
                    {d.filename ?? d.series}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {[d.size, d.link_type, d.pack ? `pack (${d.issues ?? '?'})` : null, d.updated_date]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  variant="outlined"
                  color={
                    d.status === 'Completed' ? 'success' : d.status === 'Failed' ? 'error' : 'info'
                  }
                  label={d.status}
                />
              </Stack>
            ))}
          </Stack>
        )}
      </Paper>

      <ImageLightbox
        src={zoom ? fileCoverUrl(zoom) : null}
        onClose={() => setZoom(null)}
      />
    </Stack>
  )
}
