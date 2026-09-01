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
import { useSeriesDetail } from './api'
import { HaveBar } from './HaveBar'
import { StatusChip } from './StatusChip'
import { IssuesTab } from './IssuesTab'
import { SearchResultsTab } from './SearchResultsTab'

export function SeriesDetailPage() {
  const { comicId } = useParams<{ comicId: string }>()
  const { data, isLoading, error } = useSeriesDetail(comicId)
  // Tab lives in the URL so Activity can link straight to the search evidence.
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'search' ? 1 : 0
  const setTab = (next: number) =>
    setSearchParams(next === 1 ? { tab: 'search' } : {}, { replace: true })

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
          sx={{
            width: { xs: 96, sm: 128 },
            borderRadius: 1,
            alignSelf: 'flex-start',
            boxShadow: 1,
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
        </Tabs>
      </Box>

      {tab === 0 && <IssuesTab issues={data.issues} loading={isLoading} />}
      {tab === 1 && <SearchResultsTab comicId={series.id} />}
    </Stack>
  );
}
