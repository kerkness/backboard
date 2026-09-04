import { useState } from 'react'
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import CircularProgress from '@mui/material/CircularProgress'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
import { comicArtUrl } from '../../lib/api'
import { ImageLightbox } from '../../components/ImageLightbox'
import { useSeriesDetail } from './api'
import { HaveBar } from './HaveBar'
import { StatusChip } from './StatusChip'
import { IssuesTab } from './IssuesTab'
import { SearchResultsTab } from './SearchResultsTab'
import { FilesTab } from './FilesTab'

export function SeriesDetailPage() {
  const [coverZoom, setCoverZoom] = useState(false)
  const { comicId } = useParams<{ comicId: string }>()
  const { data, isLoading, error } = useSeriesDetail(comicId)
  // Tab lives in the URL so Activity can link straight to the search evidence.
  const [searchParams, setSearchParams] = useSearchParams()
  const TABS = ['comics', 'search', 'files']
  const tab = Math.max(0, TABS.indexOf(searchParams.get('tab') ?? 'comics'))
  const setTab = (next: number) =>
    setSearchParams(next === 0 ? {} : { tab: TABS[next] }, { replace: true })

  if (error) return <Alert severity="error">{(error as Error).message}</Alert>
  if (isLoading || !data) return <CircularProgress />

  const series = data.comic[0]
  if (!series) return <Alert severity="warning">Series {comicId} not found.</Alert>

  return (
    <Stack spacing={2}>
      <Breadcrumbs>
        <Link component={RouterLink} to="/series" underline="hover" color="inherit">
          Series
        </Link>
        <Typography sx={{
          color: "text.primary"
        }}>{series.name}</Typography>
      </Breadcrumbs>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Box
          component="img"
          src={comicArtUrl(series.id)}
          alt=""
          onClick={() => setCoverZoom(true)}
          sx={{
            width: { xs: 96, sm: 128 },
            borderRadius: 1,
            alignSelf: 'flex-start',
            boxShadow: 1,
            cursor: 'zoom-in',
          }}
        />
        <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h1">{series.name}</Typography>
          <Typography variant="body2" sx={{
            color: "text.secondary"
          }}>
            {[series.publisher, series.publishYear, series.correctedBookType ?? series.bookType]
              .filter(Boolean)
              .join(' · ')}
          </Typography>
          <Stack direction="row" spacing={1} sx={{
            alignItems: "center"
          }}>
            <StatusChip status={series.status} />
            <Box sx={{ maxWidth: 180 }}>
              <HaveBar have={series.haveIssues} total={series.totalIssues} />
            </Box>
          </Stack>
        </Stack>
      </Stack>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" allowScrollButtonsMobile>
          <Tab label={`Comics (${data.issues.length})`} />
          <Tab label="Search Results" />
          <Tab label="Files" />
        </Tabs>
      </Box>

      {tab === 0 && <IssuesTab issues={data.issues} loading={isLoading} comicId={series.id} />}
      {tab === 1 && <SearchResultsTab comicId={series.id} />}
      {tab === 2 && <FilesTab comicId={series.id} />}

      <ImageLightbox
        src={coverZoom ? comicArtUrl(series.id) : null}
        alt={series.name ?? ''}
        onClose={() => setCoverZoom(false)}
      />
    </Stack>
  );
}
