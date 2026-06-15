import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SoundtrackPage from './pages/SoundtrackPage'
import AudioCoachPage from './pages/AudioCoachPage'
import SharePage from './pages/SharePage'
import SiteHeader from './components/SiteHeader'

export default function App() {
  return (
    <>
      <SiteHeader />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/soundtrack" element={<SoundtrackPage />} />
        <Route path="/audio-coach" element={<AudioCoachPage />} />
        <Route path="/share/:id" element={<SharePage />} />
      </Routes>
    </>
  )
}
