import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { comicArtUrl } from '../../lib/api'
import { DataTable } from '../../components/DataTable'
import { ImageLightbox } from '../../components/ImageLightbox'
import { GlobalSeriesSearch } from './GlobalSeriesSearch'
import type { Column } from '../../components/DataTable'
import { useSeriesIndex } from './api'
import type { Series } from './types'
import { HaveBar } from './HaveBar'
import { StatusChip } from './StatusChip'

/** Row click navigates to the series, so the cover has to swallow its own click. */
function SeriesCover({
  row,
  size,
  onZoom,
}: {
  row: Series
  size: number
  onZoom: (r: Series) => void
}) {
  return (
    <Avatar
      variant="rounded"
      src={comicArtUrl(row.id)}
      alt=""
      onClick={(e) => {
        e.stopPropagation()
        onZoom(row)
      }}
      sx={{ width: size, height: Math.round(size * 1.5), cursor: 'zoom-in' }}
    />
  )
}

const buildColumns = (onZoom: (r: Series) => void): Column<Series>[] => [
  {
    key: 'name',
    header: 'Comic',
    sortValue: (r) => r.name,
    render: (r) => (
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <SeriesCover row={r} size={24} onZoom={onZoom} />
        <span>{r.name}</span>
      </Stack>
    ),
  },
  { key: 'publisher', header: 'Publisher', sortValue: (r) => r.publisher },
  { key: 'year', header: 'Year', width: 80, sortValue: (r) => r.year },
  { key: 'latestIssue', header: 'Last Issue', width: 100, sortValue: (r) => r.latestIssue },
  { key: 'publishYear', header: 'Published', sortValue: (r) => r.publishYear },
  {
    key: 'haveIssues',
    header: 'Have',
    width: 120,
    sortValue: (r) => (r.totalIssues ? (r.haveIssues ?? 0) / r.totalIssues : -1),
    render: (r) => <HaveBar have={r.haveIssues} total={r.totalIssues} />,
  },
  {
    key: 'status',
    header: 'Status',
    width: 110,
    sortValue: (r) => r.status,
    render: (r) => <StatusChip status={r.status} />,
  },
]

const buildRenderCard = (onZoom: (r: Series) => void) => (r: Series) => (
  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
    <SeriesCover row={r} size={36} onZoom={onZoom} />
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
        {r.name}
      </Typography>
      <Typography variant="caption" noWrap sx={{ color: 'text.secondary', display: 'block' }}>
        {[r.publisher, r.year].filter(Boolean).join(' · ')}
      </Typography>
      <Box sx={{ mt: 0.5, maxWidth: 160 }}>
        <HaveBar have={r.haveIssues} total={r.totalIssues} />
      </Box>
    </Box>
    <StatusChip status={r.status} />
  </Stack>
)

export function SeriesListPage() {
  const { data, isLoading, error } = useSeriesIndex()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [zoom, setZoom] = useState<Series | null>(null)
  const query = searchParams.get('q')?.toLowerCase() ?? ''

  const columns = useMemo(() => buildColumns(setZoom), [])
  const renderCard = useMemo(() => buildRenderCard(setZoom), [])

  const rows = useMemo(() => {
    if (!data) return []
    if (!query) return data
    return data.filter(
      (s) => s.name?.toLowerCase().includes(query) || s.publisher?.toLowerCase().includes(query),
    )
  }, [data, query])

  if (error) return <Alert severity="error">{(error as Error).message}</Alert>

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
        <Typography variant="h1">Series</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {query ? `${rows.length} matching “${searchParams.get('q')}”` : rows.length}
        </Typography>
      </Stack>

      <Paper variant="outlined">
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          renderCard={renderCard}
          loading={isLoading}
          emptyMessage={query ? 'No series match that search.' : 'No series on the watchlist.'}
          onRowClick={(r) => navigate(`/series/${r.id}`)}
          initialSort={{ key: 'name', dir: 'asc' }}
          pageSize={50}
        />
      </Paper>

      {/* The watchlist above answers "do I follow this?"; this answers "does it exist?" */}
      <GlobalSeriesSearch
        query={searchParams.get('q') ?? ''}
        auto={searchParams.get('cv') === '1'}
      />

      <ImageLightbox
        src={zoom ? comicArtUrl(zoom.id) : null}
        alt={zoom?.name ?? ''}
        onClose={() => setZoom(null)}
      />
    </Stack>
  )
}
