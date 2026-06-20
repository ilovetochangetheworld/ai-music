export type PracticeMode = 'free' | 'pitch' | 'rhythm' | 'breath'
export type MetricKey = 'pitch' | 'rhythm' | 'breath' | 'expression' | 'consistency'
export type MetricStatus = 'ok' | 'insufficient_data'

export interface ReferenceNote {
  startSec: number
  endSec: number
  midi: number
  lineId: string
  sustained: boolean
}

export interface ReferencePhrase {
  id: string
  startSec: number
  endSec: number
  lineIds: string[]
  breathWindows: Array<{ startSec: number; endSec: number }>
}

export interface PracticeSongManifest {
  version: '1.0'
  id: string
  title: string
  artist: string
  durationSec: number
  difficulty: 1 | 2 | 3 | 4 | 5
  focus: MetricKey[]
  vocalRange?: { lowMidi: number; highMidi: number }
  assets: {
    accompaniment: string
    rescueLead?: string
    harmony?: string
    cover?: string
    timeline: string
    notes: string
    phrases: string
  }
  rights: { status: 'prototype' | 'licensed'; note: string }
}

export interface PracticeTelemetryFrame {
  at: number
  db: number
  pitchHz: number
  clarity: number
  vadProbability: number
  isSinging: boolean
}

export interface PracticeSessionPayload {
  version: '1.0'
  songId: string
  songVersion: string
  mode: PracticeMode
  startedAt: string
  noiseFloorDb: number
  frames: PracticeTelemetryFrame[]
  events: Array<{ type: string; at: number; [key: string]: unknown }>
}

export interface EvidenceSegment {
  startSec: number
  endSec: number
  lineId?: string | null
}

export interface MetricScore {
  key: MetricKey
  label: string
  score: number | null
  confidence: number
  status: MetricStatus
  evidence: string
  suggestion: string
  segments: EvidenceSegment[]
}

export interface PracticeReport {
  version: '1.0'
  sessionId: string
  songId: string
  status: 'complete' | 'insufficient_data' | 'failed'
  overallScore: number | null
  dataQuality: {
    vocalCoverage: number
    pitchConfidence: number
    noiseFloorDb: number
    reasons: string[]
  }
  metrics: MetricScore[]
  highlights: EvidenceSegment[]
  headline: string
  primarySuggestion: string
}

export interface TuneJob {
  id: string
  sessionId: string
  status: 'queued' | 'processing' | 'complete' | 'failed' | 'disabled'
  sourceUrl?: string
  tunedUrl?: string
  changes: string[]
  error?: string
}
