// ── 核心数据模型，遵循 docs/data-model.md 与 prompts/* 契约 ──

export type MoodKey =
  | 'warm' | 'soft' | 'romantic' | 'hopeful' | 'release'
  | 'reflective' | 'sad' | 'restrained' | 'fresh' | 'optimistic'
  | 'energetic' | 'calm'

export interface Song {
  id: string
  mid?: string
  mediaMid?: string
  songType?: number
  title: string
  artist: string
  album?: string
  coverUrl?: string
  playUrl?: string
  detailUrl?: string
  source?: 'mock' | 'qqmusic'
  language: 'mandarin' | 'cantonese' | 'english' | 'instrumental'
  releaseYear?: number
  genre?: string[]
  version?: 'studio' | 'live' | 'cover' | 'instrumental'
  semanticDescription?: string
  playCount?: number
  lastPlayedAt?: string
  mood: string[]
  scene: string[]
  energy: number // 0-100
  bpm: number
  tags: string[]
  reasonSeeds: string[]
  previewUrl?: string
}

export interface MoodPoint {
  label: string
  energy: number
}

export interface LifeScene {
  id: string
  label: string
  timeOfDay: string
  sourceEvent: string
  emotion: string
  energy: number
  musicIntent: string
  recommendedTags: string[]
  searchKeywords?: string[]
  djNarration: string
  /** 由 songMatcher 填充 */
  recommendedSongs: Song[]
}

export interface Soundtrack {
  id: string
  title: string
  subtitle: string
  date: string
  overallEmotion: string
  moodPath: MoodPoint[]
  scenes: LifeScene[]
  openingNarration: string
  closingNarration: string
  shareCopy: string
  /** 生成所用的原始输入，用于追溯 */
  sourceText: string
}

export interface TranscriptSegment {
  id: string
  start: string
  end: string
  speaker: string
  text: string
  topics?: string[]
}

export interface AudioChapter {
  id: string
  start: string
  end: string
  title: string
  summary: string
  keywords: string[]
  importance: number // 0-100
}

export interface RouteStep {
  start: string
  end: string
  reason: string
}

export interface TranscriptAnalysis {
  id: string
  audioTitle: string
  brief: string
  chapters: AudioChapter[]
  threeMinuteRoute: RouteStep[]
  fifteenMinuteRoute: RouteStep[]
  quotes: string[]
  questionsToAsk: string[]
  segments: TranscriptSegment[]
}

export interface CoachSegment {
  start: string
  end: string
  title: string
  reason: string
}

export interface CoachAnswer {
  answer: string
  segments: CoachSegment[]
  followUpQuestions: string[]
}

export interface UserPreference {
  languages?: string[]
  avoid?: string[]
}
