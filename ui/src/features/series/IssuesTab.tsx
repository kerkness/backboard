import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import SearchIcon from '@mui/icons-material/Search'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import type { Issue } from './types'
import { StatusChip } from './StatusChip'
import { useStartSearch } from './api'
import { useToast } from '../../app/ToastProvider'

/**
 * ComicVine carries no title for ~44% of watched series (Monstress, the Ultimate line and
 * others number their issues without titling them), so `name` is null. Fall back to
 * "Series (issue)" rather than leaving the column blank, which reads as a fetch failure.
 *
 * The 'None' check is deliberate: importer.py:1256 stores that literal string, not NULL,
 * on one of its code paths.
 */
function issueTitle(issue: Issue) {
  if (issue.name && issue.name !== 'None') return issue.name
  const series = issue.comicName?.trim()
  const number = issue.number?.trim()
  if (!series) return number ? `Issue ${number}` : ''
  return number ? `${series} (${number})` : series
}

function SearchButton({ issue }: { issue: Issue }) {
  const startSearch = useStartSearch()
  const toast = useToast()
  return (
    <Tooltip title="Search providers for this issue">
      <span>
        <IconButton
          size="small"
          disabled={startSearch.isPending}
          onClick={(e) => {
            e.stopPropagation()
            startSearch.mutate(
              { scope: 'issue', id: issue.id },
              {
                onSuccess: (r) => toast(r.message, 'info'),
                onError: (err) => toast((err as Error).message, 'error'),
              },
            )
          }}
        >
          <SearchIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  )
}

const columns: Column<Issue>[] = [
  { key: 'number', header: '#', width: 80, sortValue: (r) => Number(r.number) || r.number },
  { key: 'name', header: 'Title', sortValue: issueTitle, render: issueTitle },
  { key: 'issueDate', header: 'Issue Date', width: 120, sortValue: (r) => r.issueDate },
  { key: 'releaseDate', header: 'Released', width: 120, sortValue: (r) => r.releaseDate },
  {
    key: 'status',
    header: 'Status',
    width: 120,
    sortValue: (r) => r.status,
    render: (r) => <StatusChip status={r.status} />,
  },
  { key: 'search', header: '', width: 56, align: 'right', render: (r) => <SearchButton issue={r} /> },
]

const renderCard = (r: Issue) => (
  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
    <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 36 }}>
      #{r.number}
    </Typography>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="body2" noWrap>
        {issueTitle(r)}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {r.issueDate}
      </Typography>
    </Box>
    <StatusChip status={r.status} />
    <SearchButton issue={r} />
  </Stack>
)

export function IssuesTab({ issues, loading }: { issues: Issue[]; loading: boolean }) {
  return (
    <Paper variant="outlined">
      <DataTable
        rows={issues}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        loading={loading}
        emptyMessage="No issues recorded for this series."
        initialSort={{ key: 'number', dir: 'desc' }}
        pageSize={25}
      />
    </Paper>
  )
}
