import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import LinearProgress from '@mui/material/LinearProgress'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TablePagination from '@mui/material/TablePagination'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useDownloads } from './api'
import { FilesPanel } from './FilesPanel'
import type { Download, PpFile } from './types'

const PAGE = 20
const FILTERS = [
  { label: 'All', status: undefined },
  { label: 'Downloading', status: 'Downloading' },
  { label: 'Completed', status: 'Completed' },
  { label: 'Failed', status: 'Failed' },
]
// Files sits alongside the status filters as the last tab.
const FILES_TAB = FILTERS.length

const OUTCOME_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  filed: 'success',
  duplicate: 'warning',
  failed: 'error',
}

function FileRow({ f }: { f: PpFile }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', py: 0.5 }}>
      <Chip
        size="small"
        variant="outlined"
        color={OUTCOME_COLOR[f.outcome] ?? 'default'}
        label={f.outcome}
        sx={{ flexShrink: 0, minWidth: 84 }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
          {f.filename}
        </Typography>
        {f.detail && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {f.detail}
          </Typography>
        )}
      </Box>
    </Stack>
  )
}

function DownloadRow({ d }: { d: Download }) {
  const pp = d.postprocess
  const live = d.status === 'Downloading'

  return (
    <Accordion disableGutters variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ minWidth: 0, width: '100%' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
              {d.series ?? d.filename ?? d.id}
            </Typography>
            {d.pack ? <Chip size="small" variant="outlined" label="pack" /> : null}
            <Chip
              size="small"
              variant="outlined"
              color={
                d.status === 'Completed' ? 'success' : d.status === 'Failed' ? 'error' : 'info'
              }
              label={d.status}
            />
            {pp && (
              <Chip
                size="small"
                variant="outlined"
                color={pp.filed_count > 0 ? 'success' : 'warning'}
                label={`${pp.filed_count} filed · ${pp.duplicate_count} dupe${
                  pp.failed_count ? ` · ${pp.failed_count} failed` : ''
                }`}
              />
            )}
            <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
              {d.size} {d.updated_date ? `· ${d.updated_date}` : ''}
            </Typography>
          </Stack>
          {live && d.percent !== null && (
            <LinearProgress
              variant="determinate"
              value={d.percent}
              sx={{ mt: 0.75, height: 4, borderRadius: 2 }}
            />
          )}
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        {d.warning && (
          <Alert severity="warning" sx={{ mb: 1.5 }}>
            {d.warning}
          </Alert>
        )}

        <Stack direction="row" spacing={2} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {d.site} {d.link_type ? `· ${d.link_type}` : ''}
          </Typography>
          {d.issues && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              posting advertised: {d.issues}
            </Typography>
          )}
          {d.comicid && (
            <Link component={RouterLink} to={`/series/${d.comicid}`} variant="caption" underline="hover">
              open series
            </Link>
          )}
        </Stack>

        {d.filename && (
          <Box
            component="pre"
            sx={{
              m: 0,
              mb: 1.5,
              p: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              fontSize: 12,
              overflowX: 'auto',
            }}
          >
            {d.filename}
          </Box>
        )}

        {!pp ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {live
              ? 'Still downloading — post-processing has not run yet.'
              : 'No post-processing recorded for this download.'}
          </Typography>
        ) : pp.files.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Post-processing handled {pp.files_total} file(s); no per-file detail recorded.
          </Typography>
        ) : (
          <Stack divider={<Divider />}>
            {pp.files.map((f, i) => (
              <FileRow key={`${pp.pp_id}-${i}`} f={f} />
            ))}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  )
}

export function DownloadsPage() {
  const [tab, setTab] = useState(0)
  const [page, setPage] = useState(0)
  const { data, isLoading, error } = useDownloads({
    limit: PAGE,
    offset: page * PAGE,
    status: FILTERS[tab]?.status,
  })

  if (error) return <Alert severity="error">{(error as Error).message}</Alert>

  return (
    <Stack spacing={2}>
      <Typography variant="h1">Downloads</Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => {
          setTab(v)
          setPage(0)
        }}
        variant="scrollable"
        allowScrollButtonsMobile
      >
        {FILTERS.map((f) => (
          <Tab key={f.label} label={f.label} />
        ))}
        <Tab label="Files" />
      </Tabs>

      {tab === FILES_TAB && <FilesPanel />}

      {tab !== FILES_TAB && isLoading && !data && <CircularProgress size={20} />}

      {tab !== FILES_TAB && data?.downloads.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nothing here.
        </Typography>
      )}

      {tab !== FILES_TAB && data?.downloads.map((d) => <DownloadRow key={d.id} d={d} />)}

      {tab !== FILES_TAB && (data?.total ?? 0) > PAGE && (
        <TablePagination
          component="div"
          count={data!.total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={PAGE}
          rowsPerPageOptions={[PAGE]}
        />
      )}
    </Stack>
  )
}
