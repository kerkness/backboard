import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Tooltip from '@mui/material/Tooltip'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { DataTable } from '../../components/DataTable'
import type { Column } from '../../components/DataTable'
import { StatusChip } from '../series/StatusChip'
import { useAddSeries, useWeeklyPull } from './api'
import type { WeeklyIssue } from './types'

/** weekly has no stable primary key exposed, so identify a release by its own fields. */
const rowId = (r: WeeklyIssue) =>
  `${r.comicId ?? r.dynamicName ?? r.comicName}-${r.issueNumber}-${r.shipDate}`

function shiftWeek(week: string, year: string, delta: number) {
  // Weeks are %U (0-53). Step through a real date so year boundaries behave.
  const approx = new Date(Number(year), 0, 1 + (Number(week) + delta) * 7)
  const start = new Date(approx.getFullYear(), 0, 1)
  const days = Math.floor((approx.getTime() - start.getTime()) / 86_400_000)
  const w = Math.floor((days + start.getDay()) / 7)
  return { week: String(w).padStart(2, '0'), year: String(approx.getFullYear()) }
}

const comicVineUrl = (r: WeeklyIssue) =>
  r.detailsURL ?? (r.comicId ? `https://comicvine.gamespot.com/volume/4050-${r.comicId}/` : null)

function SeriesTitle({ row, children }: { row: WeeklyIssue; children: React.ReactNode }) {
  if (!row.watchedComicId) return <>{children}</>
  return (
    <Link component={RouterLink} to={`/series/${row.watchedComicId}`} underline="hover">
      {children}
    </Link>
  )
}

function ComicVineLink({ row }: { row: WeeklyIssue }) {
  const href = comicVineUrl(row)
  if (!href) return null
  return (
    <Tooltip title="Open on ComicVine">
      <IconButton
        size="small"
        href={href}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <OpenInNewIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  )
}

export function WeeklyPage() {
  const [cursor, setCursor] = useState<{ week?: string; year?: string }>({})
  const { data, isLoading, error } = useWeeklyPull(cursor.week, cursor.year)
  const addSeries = useAddSeries()

  function AddOrOpen({ row }: { row: WeeklyIssue }) {
    // Followed series are reachable from the linked title, so no button here.
    if (row.watchedComicId || !row.comicId) return null
    return (
      <Button
        size="small"
        startIcon={<AddIcon />}
        disabled={addSeries.isPending}
        onClick={(e) => {
          e.stopPropagation()
          addSeries.mutate(row.comicId!)
        }}
      >
        Add
      </Button>
    )
  }

  const columns: Column<WeeklyIssue>[] = [
    {
      key: 'comicName',
      header: 'Comic',
      sortValue: (r) => r.comicName,
      render: (r) => <SeriesTitle row={r}>{r.comicName}</SeriesTitle>,
    },
    { key: 'issueNumber', header: '#', width: 70, sortValue: (r) => Number(r.issueNumber) || r.issueNumber },
    { key: 'publisher', header: 'Publisher', sortValue: (r) => r.publisher },
    { key: 'shipDate', header: 'Ships', width: 110, sortValue: (r) => r.shipDate },
    {
      key: 'status',
      header: 'Status',
      width: 110,
      sortValue: (r) => r.status,
      render: (r) => <StatusChip status={r.status} />,
    },
    { key: 'actions', header: '', width: 90, align: 'right', render: (r) => <AddOrOpen row={r} /> },
    { key: 'cv', header: '', width: 48, align: 'right', render: (r) => <ComicVineLink row={r} /> },
  ]

  const renderCard = (r: WeeklyIssue) => (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
          <SeriesTitle row={r}>{r.comicName}</SeriesTitle> #{r.issueNumber}
        </Typography>
        <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
          {[r.publisher, r.shipDate].filter(Boolean).join(' · ')}
        </Typography>
      </Box>
      <AddOrOpen row={r} />
      <ComicVineLink row={r} />
    </Stack>
  )

  if (error) return <Alert severity="error">{(error as Error).message}</Alert>

  const week = data?.week ?? ''
  const year = data?.year ?? ''
  const watched = data?.issues.filter((i) => i.watchedComicId).length ?? 0

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="h1">This Week</Typography>
        <IconButton
          size="small"
          aria-label="Previous week"
          disabled={!week}
          onClick={() => setCursor(shiftWeek(week, year, -1))}
        >
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Week {week} · {year}
        </Typography>
        <IconButton
          size="small"
          aria-label="Next week"
          disabled={!week}
          onClick={() => setCursor(shiftWeek(week, year, 1))}
        >
          <ChevronRightIcon />
        </IconButton>
        {cursor.week && (
          <Button size="small" onClick={() => setCursor({})}>
            Today
          </Button>
        )}
        <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto' }}>
          {data?.issues.length ?? 0} releases · {watched} tracked
        </Typography>
      </Stack>

      {addSeries.isError && <Alert severity="error">{(addSeries.error as Error).message}</Alert>}
      {addSeries.isSuccess && <Alert severity="success">Queued. All issues marked Wanted.</Alert>}

      <Paper variant="outlined">
        <DataTable
          rows={data?.issues ?? []}
          columns={columns}
          getRowId={rowId}
          renderCard={renderCard}
          loading={isLoading}
          emptyMessage="No releases listed for this week."
          initialSort={{ key: 'publisher', dir: 'asc' }}
          pageSize={50}
        />
      </Paper>
    </Stack>
  )
}
