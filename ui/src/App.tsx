import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './app/Layout'
import { SeriesListPage } from './features/series/SeriesListPage'
import { SeriesDetailPage } from './features/series/SeriesDetailPage'
import { WeeklyPage } from './features/weekly/WeeklyPage'
import { ActivityPage } from './features/activity/ActivityPage'
import { DownloadsPage } from './features/downloads/DownloadsPage'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Series is always where we start (DESIGN.md). */}
        <Route index element={<Navigate to="/series" replace />} />
        <Route path="series" element={<SeriesListPage />} />
        <Route path="series/:comicId" element={<SeriesDetailPage />} />
        <Route path="this-week" element={<WeeklyPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="*" element={<Navigate to="/series" replace />} />
      </Route>
    </Routes>
  )
}
