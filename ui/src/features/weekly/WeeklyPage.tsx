import { useEffect, useState } from 'react'
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
import { ImageLightbox } from '../../components/ImageLightbox'
import type { Column } from '../../components/DataTable'
import { StatusChip } from '../series/StatusChip'
import { useAddSeries, usePrefetchPullCovers, useWeeklyPull } from './api'
import type { WeeklyIssue } from './types'
import { pullCoverUrl } from '../../lib/api'
import { PullCover } from './PullCover'
import { formatWeekRange, shiftWeek } from './week'

/** weekly has no stable primary key exposed, so identify a release by its own fields. */
const rowId = (r: WeeklyIssue) =>
  `${r.comicId ?? r.dynamicName ?? r.comicName}-${r.issueNumber}-${r.shipDate}`

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

  // Covers arrive after the page does. Bumping the epoch re-requests the ones
  // that missed; the retries are spaced out because a cold week downloads ~70
  // images. Everything is cache-only server-side, so a retry is cheap.
  const [coverEpoch, setCoverEpoch] = useState(0)
  const [zoom, setZoom] = useState<WeeklyIssue | null>(null)
  const prefetchCovers = usePrefetchPullCovers()
  const week = data?.week ?? ''
  const year = data?.year ?? ''

  useEffect(() => {
    if (!week || !year) return
    let timers: ReturnType<typeof setTimeout>[] = []
    prefetchCovers.mutateAsync({ week, year }).then(
      (res) => {
        if (!res.started) return
        timers = [4_000, 12_000, 30_000].map((ms) =>
          setTimeout(() => setCoverEpoch((n) => n + 1), ms),
        )
      },
      // A prefetch failure just means no new art this pass; the cached covers
      // that are already there still render.
      () => {},
    )
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, year])

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
      key: 'cover',
      header: '',
      width: 52,
      render: (r) => <PullCover row={r} epoch={coverEpoch} onClick={() => setZoom(r)} />,
    },
    {
      key: 'comicName',
      header: 'Comic',
      sortValue: (r) => r.comicName,
      render: (r) => <SeriesTitle row={r}>{r.comicName}</SeriesTitle>,
    },
    { key: 'issueNumber', header: '#', width: 70, sortValue: (r) => Number(r.issueNumber) || r.issueNumber },
    { key: 'publisher', header: 'Publisher', sortValue: (r) => r.publisher },
    {
      key: 'shipDate',
      header: 'Ships',
      width: 118,
      sortValue: (r) => r.shipDate,
      // An ISO date is one token; letting it wrap to "2026-09-" / "02" reads as data damage.
      render: (r) => <Box sx={{ whiteSpace: 'nowrap' }}>{r.shipDate}</Box>,
    },
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
      <PullCover row={r} epoch={coverEpoch} onClick={() => setZoom(r)} />
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
        {/* Fixed width so the arrows don't shuffle as the label changes length. */}
        <Stack sx={{ alignItems: 'center', minWidth: 186 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {formatWeekRange(week, year)}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2 }}>
            Week {week} · {year}
          </Typography>
        </Stack>
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

      <ImageLightbox
        src={zoom ? pullCoverUrl(zoom.issueId, zoom.comicId, coverEpoch, 'zoom') : null}
        alt={zoom ? `${zoom.comicName} #${zoom.issueNumber}` : ''}
        onClose={() => setZoom(null)}
      />
    </Stack>
  )
}
