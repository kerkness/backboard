import { Link as RouterLink } from 'react-router-dom'
import { useState } from 'react'
import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import TablePagination from '@mui/material/TablePagination'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useActivity } from './api'
import { useRecentSearchRuns } from '../series/api'
import type { Job, QueueSnapshot } from './types'
import type { SearchRun } from '../series/searchTypes'

/** "in 3m", "in 2h 5m", "overdue" — the countdown is the point of this screen. */
function until(seconds: number | null) {
  if (seconds === null) return '—'
  if (seconds <= 0) return 'due now'
  const m = Math.round(seconds / 60)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  return `in ${h}h ${m % 60}m`
}

const ago = (t: number | null) => {
  if (!t) return 'never'
  const m = Math.round((Date.now() / 1000 - t) / 60)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="h2" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      {children}
    </Paper>
  )
}

function QueueRow({ label, q }: { label: string; q: QueueSnapshot }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5 }}>
      <Typography variant="body2" sx={{ minWidth: 110 }}>
        {label}
      </Typography>
      <Chip
        size="small"
        label={q.size}
        color={q.size > 0 ? 'primary' : 'default'}
        variant={q.size > 0 ? 'filled' : 'outlined'}
      />
      {q.error && <Typography variant="caption" color="error">{q.error}</Typography>}
    </Stack>
  )
}

function JobRow({ job }: { job: Job }) {
  const paused = job.status === 'Paused'
  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ alignItems: 'center', py: 0.75, flexWrap: 'wrap' }}
    >
      <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 500 }}>
        {job.name}
      </Typography>
      <Chip
        size="small"
        variant="outlined"
        label={job.status ?? 'Unknown'}
        color={paused ? 'default' : 'success'}
      />
      <Typography variant="body2" sx={{ color: paused ? 'text.disabled' : 'text.primary' }}>
        {paused ? 'not scheduled' : until(job.seconds_until)}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
        last {ago(job.prev_run)}
      </Typography>
    </Stack>
  )
}

function RunRow({ run }: { run: SearchRun }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.5, flexWrap: 'wrap' }}>
      <Typography variant="body2" sx={{ minWidth: 0, flex: 1 }} noWrap>
        {run.comicid ? (
          <Link component={RouterLink} to={`/series/${run.comicid}?tab=search`} underline="hover">
            {run.comicname} #{run.issuenumber}
          </Link>
        ) : (
          `${run.comicname} #${run.issuenumber}`
        )}
      </Typography>
      <Chip
        size="small"
        variant="outlined"
        color={run.accepted_count > 0 ? 'success' : 'default'}
        label={`${run.candidate_count} found · ${run.accepted_count} matched`}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 70, textAlign: 'right' }}>
        {ago(run.started)}
      </Typography>
    </Stack>
  )
}

const RUNS_PAGE = 10

export function ActivityPage() {
  const { data, isLoading, error } = useActivity()
  const [runPage, setRunPage] = useState(0)
  const runs = useRecentSearchRuns({ limit: RUNS_PAGE, offset: runPage * RUNS_PAGE })

  if (error) return <Alert severity="error">{(error as Error).message}</Alert>
  if (isLoading || !data) return <CircularProgress />

  const { queues, jobs, locks, ddl_status, search_totals } = data
  const nextJob = jobs.find((j) => j.status !== 'Paused' && j.seconds_until !== null)
  const busy = locks.search || locks.ddl || queues.search.size > 0 || queues.ddl.size > 0

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexWrap: 'wrap' }}>
        <Typography variant="h1">Activity</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {busy
            ? 'Working'
            : nextJob
              ? `Idle · next is ${nextJob.name} ${until(nextJob.seconds_until)}`
              : 'Idle'}
        </Typography>
      </Stack>

      <Accordion disableGutters variant="outlined" defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h2">Queues &amp; schedule</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Queues
              </Typography>
              <QueueRow label="Search" q={queues.search} />
              <QueueRow label="Downloads" q={queues.ddl} />
              <QueueRow label="Post-process" q={queues.postprocess} />
              <QueueRow label="NZB" q={queues.nzb} />
              <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                {locks.search && <Chip size="small" color="info" label="Search in progress" />}
                {locks.ddl && <Chip size="small" color="info" label="Download in progress" />}
                {Object.entries(ddl_status).map(([k, v]) => (
                  <Chip key={k} size="small" variant="outlined" label={`${k}: ${v}`} />
                ))}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Schedule
              </Typography>
              <Stack divider={<Divider />}>
                {jobs.map((job) => <JobRow key={job.name} job={job} />)}
              </Stack>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      <Section title="Recent searches">
        <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
          <Chip size="small" variant="outlined" label={`${search_totals.runs} runs`} />
          <Chip size="small" variant="outlined" label={`${search_totals.candidates} candidates`} />
          <Chip
            size="small"
            variant="outlined"
            color={search_totals.accepted > 0 ? 'success' : 'warning'}
            label={`${search_totals.accepted} matched`}
          />
        </Stack>
        {!runs.data || runs.data.runs.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No searches recorded yet.
          </Typography>
        ) : (
          <>
            <Stack divider={<Divider />}>
              {runs.data.runs.map((run) => <RunRow key={run.run_id} run={run} />)}
            </Stack>
            <TablePagination
              component="div"
              count={runs.data.total}
              page={runPage}
              onPageChange={(_, p) => setRunPage(p)}
              rowsPerPage={RUNS_PAGE}
              rowsPerPageOptions={[RUNS_PAGE]}
            />
          </>
        )}
      </Section>

      {queues.search.size > 0 && (
        <Accordion disableGutters variant="outlined">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h2">Queued searches ({queues.search.size})</Typography>
          </AccordionSummary>
          <AccordionDetails>
          <Stack divider={<Divider />}>
            {queues.search.items.map((item, i) => (
              <Stack
                key={`${item.issueid ?? item.comicname}-${i}`}
                direction="row"
                spacing={1}
                sx={{ alignItems: 'center', py: 0.5 }}
              >
                <Typography variant="body2" sx={{ minWidth: 24, color: 'text.secondary' }}>
                  {i + 1}
                </Typography>
                <Typography variant="body2" sx={{ minWidth: 0, flex: 1 }} noWrap>
                  {item.comicid ? (
                    <Link component={RouterLink} to={`/series/${item.comicid}?tab=search`} underline="hover">
                      {item.comicname}
                      {item.issuenumber ? ` #${item.issuenumber}` : ''}
                    </Link>
                  ) : (
                    item.comicname
                  )}
                </Typography>
              </Stack>
            ))}
          </Stack>
          {queues.search.size > queues.search.items.length && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              …and {queues.search.size - queues.search.items.length} more
            </Typography>
          )}
          </AccordionDetails>
        </Accordion>
      )}

      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Refreshes every 10s.
        </Typography>
      </Box>
    </Stack>
  )
}
