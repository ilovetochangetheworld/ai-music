export type SongSectionType = 'intro' | 'verse' | 'prechorus' | 'chorus' | 'interlude' | 'outro'

export interface SongSection {
  id: string
  type: SongSectionType
  label: string
  start: number
  end: number
  vocalExpected: boolean
  harmonyEnabled: boolean
}

export interface LyricLine {
  id: string
  start: number
  end: number
  text: string
  section: SongSectionType
  rescuable: boolean
  harmonyEnabled: boolean
  breathProtectionMs: number
}

export interface SongTimeline {
  songId: string
  title: string
  artist: string
  duration: number
  bpm: number
  demoCueSec: number
  sections: SongSection[]
  lines: LyricLine[]
}

export interface SongManifest {
  songId: string
  title: string
  artist: string
  duration: number
  assets: {
    accompaniment: string
    rescueLead: string
    harmony: string
  }
  mix: {
    accompanimentGain: number
    rescueGain: number
    harmonyGain: number
  }
}

export type SingEvent =
  | { type: 'SONG_STARTED'; at: number }
  | { type: 'USER_STARTED'; at: number }
  | { type: 'USER_STOPPED'; at: number; silenceMs: number }
  | { type: 'RESCUE_STARTED'; at: number; lineId: string; source: 'auto' | 'manual' }
  | { type: 'USER_RESUMED'; at: number }
  | { type: 'RESCUE_ENDED'; at: number; recovered: boolean }
  | { type: 'HIGHLIGHT_COMPLETED'; at: number; lineId: string }
  | { type: 'SONG_COMPLETED'; at: number }

export interface VocalFrameSample {
  at: number
  db: number
  pitch: number
  clarity: number
  isSinging: boolean
}

export interface VocalReview {
  engagement: number
  clarity: number | null
  pitchContinuity: number | null
  recovery: number | null
  headline: string
  detail: string
  suggestion: string
}

export interface SingingRecap {
  participationRate: number
  rescueCount: number
  recoveredRescueCount: number
  longestContinuousSingingSec: number
  highlightLineId: string | null
  highlightStartSec?: number | null
  highlightEndSec?: number | null
  firstHalfParticipation: number
  secondHalfParticipation: number
  review?: VocalReview
  recordingAvailable?: boolean
  events: SingEvent[]
}

export type InteractionLevel = 'quiet' | 'balanced' | 'lively'

export interface SingRoomSettings {
  interactionLevel: InteractionLevel
  autoRescue: boolean
  harmonyLevel: number
  demoMode: boolean
}

export const DEFAULT_ROOM_SETTINGS: SingRoomSettings = {
  interactionLevel: 'balanced',
  autoRescue: true,
  harmonyLevel: 0.18,
  demoMode: true,
}
