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
import { useDownloads, useStagedFiles } from './api'
import { FilesPanel } from './FilesPanel'
import { isLeftover } from './staged'
import type { Download, PpFile } from './types'

const PAGE = 20

/**
 * Tabs read from two different sources, so each one declares which.
 *
 * `Unmatched` is the staged-files view: things that downloaded fine but that
 * post-processing could not place, and which you can match by hand. That is a
 * separate state from `Failed`, where the transfer itself never completed, so
 * the two stay apart. Order runs from what usually needs attention to what
 * mostly looks after itself, which puts Downloading last.
 */
type TabDef =
  | { label: string; kind: 'downloads'; status?: string }
  | { label: string; kind: 'staged' }

const TABS: TabDef[] = [
  { label: 'All', kind: 'downloads' },
  { label: 'Downloaded', kind: 'downloads', status: 'Completed' },
  { label: 'Unmatched', kind: 'staged' },
  { label: 'Failed', kind: 'downloads', status: 'Failed' },
  { label: 'Downloading', kind: 'downloads', status: 'Downloading' },
]

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
                label={`${pp.filed_count} matched · ${pp.duplicate_count} duplicate${
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
              ? 'Still downloading. Post-processing has not run yet.'
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
  const active = TABS[tab] ?? TABS[0]
  const staged = active.kind === 'staged'
  // Badge the tab so a pile of unmatched files is visible without opening it.
  const { data: stagedFiles } = useStagedFiles()
  // Empty leftover folders aren't work; counting them overstates the backlog.
  const unmatched = stagedFiles?.files.filter((f) => !isLeftover(f)).length ?? 0
  const { data, isLoading, error } = useDownloads({
    limit: PAGE,
    offset: page * PAGE,
    status: active.kind === 'downloads' ? active.status : undefined,
    enabled: !staged,
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
        {TABS.map((t) => (
          <Tab
            key={t.label}
            label={t.kind === 'staged' && unmatched ? `${t.label} (${unmatched})` : t.label}
          />
        ))}
      </Tabs>

      {staged && <FilesPanel />}

      {!staged && isLoading && !data && <CircularProgress size={20} />}

      {!staged && data?.downloads.length === 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Nothing here.
        </Typography>
      )}

      {!staged && data?.downloads.map((d) => <DownloadRow key={d.id} d={d} />)}

      {!staged && (data?.total ?? 0) > PAGE && (
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
