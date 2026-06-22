import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import SiteHeader from './components/SiteHeader'
import PracticeHomePage from './pages/PracticeHomePage'
import SongCatalogPage from './pages/SongCatalogPage'
import SongImportPage from './pages/SongImportPage'
import SongManagementPage from './pages/SongManagementPage'
import PracticeSetupPage from './pages/PracticeSetupPage'
import PracticeReportPage from './pages/PracticeReportPage'
import PracticeHighlightPage from './pages/PracticeHighlightPage'
import GrowthPage from './pages/GrowthPage'
import SoundtrackPage from './pages/SoundtrackPage'
import AudioCoachPage from './pages/AudioCoachPage'
import ReferenceReviewPage from './pages/ReferenceReviewPage'

const PracticeSingPage = lazy(() => import('./pages/SingRoomPerformancePage'))
const PracticeRecapPage = lazy(() => import('./pages/SingRoomRecapPage'))

export default function App() {
  return <><SiteHeader /><Suspense fallback={<main className="practice-mobile practice-empty"><p>小麦正在准备练歌房…</p></main>}><Routes>
    <Route path="/" element={<PracticeHomePage />} />
    <Route path="/songs" element={<SongCatalogPage />} />
    <Route path="/songs/import" element={<SongImportPage />} />
    <Route path="/songs/manage" element={<SongManagementPage />} />
    <Route path="/practice/:songId" element={<PracticeSetupPage />} />
    <Route path="/practice/:songId/sing" element={<PracticeSingPage />} />
    <Route path="/practice/:songId/recap" element={<PracticeRecapPage />} />
    <Route path="/practice/:songId/report" element={<PracticeReportPage />} />
    <Route path="/practice/:songId/highlight" element={<PracticeHighlightPage />} />
    <Route path="/growth" element={<GrowthPage />} />
    <Route path="/growth/:sessionId" element={<PracticeReportPage />} />
    <Route path="/lab/soundtrack" element={<SoundtrackPage />} />
    <Route path="/lab/audio-coach" element={<AudioCoachPage />} />
    <Route path="/lab/reference-review/:songId" element={<ReferenceReviewPage />} />
    <Route path="*" element={<PracticeHomePage />} />
  </Routes></Suspense></>
}
