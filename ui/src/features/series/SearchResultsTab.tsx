import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Link from '@mui/material/Link'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import { useToast } from '../../app/ToastProvider'
import TablePagination from '@mui/material/TablePagination'
import { useState } from 'react'
import { useSearchRuns, useStartSearch } from './api'
import type { SearchCandidate, SearchRun } from './searchTypes'
import { reasonLabel } from './searchTypes'
import { CandidateActions } from './CandidateActions'

const when = (t: number | null) =>
  t ? new Date(t * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''

function Candidate({ c }: { c: SearchCandidate }) {
  const accepted = c.verdict === 'accepted'
  return (
    <Box
      sx={{
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        // Dismissed candidates stay readable but stop competing for attention.
        opacity: c.action === 'ignored' ? 0.5 : 1,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Chip
          size="small"
          label={accepted ? 'Accepted' : reasonLabel(c.reason)}
          color={accepted ? 'success' : 'default'}
          variant={accepted ? 'filled' : 'outlined'}
          sx={{ flexShrink: 0 }}
        />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
            {c.link ? (
              <Link href={c.link} target="_blank" rel="noreferrer" underline="hover">
                {c.title}
              </Link>
            ) : (
              c.title
            )}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {[c.size, c.year, c.pack ? 'pack' : null, c.detail, c.action_detail]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
        </Box>
        <CandidateActions c={c} />
      </Stack>
    </Box>
  )
}

function Run({ run }: { run: SearchRun }) {
  return (
    <Accordion disableGutters variant="outlined">
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            #{run.issuenumber ?? '?'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {when(run.started)} · {run.provider}
          </Typography>
          <Box sx={{ ml: 'auto' }}>
            <Chip
              size="small"
              variant="outlined"
              color={run.accepted_count > 0 ? 'success' : run.status === 'error' ? 'error' : 'default'}
              label={
                run.status === 'error'
                  ? 'Error'
                  : `${run.candidate_count} found · ${run.accepted_count} matched`
              }
            />
          </Box>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {run.error && <Alert severity="error" sx={{ mb: 1 }}>{run.error}</Alert>}

        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Searched {run.provider} for
        </Typography>
        <Box
          component="pre"
          sx={{
            m: 0,
            mb: 2,
            p: 1,
            bgcolor: 'action.hover',
            borderRadius: 1,
            fontSize: 12,
            overflowX: 'auto',
          }}
        >
          {run.queries.length ? run.queries.join('\n') : '(no query recorded)'}
        </Box>

        {run.candidates.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            The provider returned nothing for these queries.
          </Typography>
        ) : (
          run.candidates.map((c) => <Candidate key={`${c.run_id}-${c.seq}`} c={c} />)
        )}
      </AccordionDetails>
    </Accordion>
  )
}

const PAGE_SIZE = 10

export function SearchResultsTab({ comicId }: { comicId: string }) {
  const [page, setPage] = useState(0)
  const { data, isLoading, error } = useSearchRuns(comicId, {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  })
  const runs = data?.runs
  const startSearch = useStartSearch()
  const toast = useToast()

  const searchSeries = () =>
    startSearch.mutate(
      { scope: 'series', id: comicId },
      {
        onSuccess: (r) => toast(r.message, r.queued ? 'info' : 'warning'),
        onError: (e) => toast((e as Error).message, 'error'),
      },
    )

  if (error) return <Alert severity="error">{(error as Error).message}</Alert>

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="small"
          startIcon={startSearch.isPending ? <CircularProgress size={16} /> : <SearchIcon />}
          disabled={startSearch.isPending}
          onClick={searchSeries}
        >
          Search all wanted
        </Button>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Runs in the background, roughly 45s per issue.
        </Typography>
      </Stack>

      {isLoading && <CircularProgress size={20} />}

      {!isLoading && (!runs || runs.length === 0) && (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No searches recorded for this series yet.
          </Typography>
        </Paper>
      )}

      {runs?.map((run) => <Run key={run.run_id} run={run} />)}

      {(data?.total ?? 0) > PAGE_SIZE && (
        <TablePagination
          component="div"
          count={data!.total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={PAGE_SIZE}
          rowsPerPageOptions={[PAGE_SIZE]}
        />
      )}
    </Stack>
  )
}
