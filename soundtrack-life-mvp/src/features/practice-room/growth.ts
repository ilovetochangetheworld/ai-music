import type { MetricKey, PracticeReport } from '../../../shared/contracts'
import { loadPracticeManifest } from './catalog'

export interface GrowthEntry {
  id: string
  songId: string
  songTitle?: string
  createdAt: string
  overallScore: number | null
  metrics: Array<{ key: MetricKey; score: number | null; confidence: number }>
  highlight?: { startSec: number; endSec: number }
  report?: PracticeReport
}

export interface MetricTrend {
  key: MetricKey
  latest: number | null
  average: number | null
  delta: number | null
  validSessions: number
  averageConfidence: number
}

const DB_NAME = 'ai-practice-room'
const STORE = 'growth'

export async function saveGrowthReport(report: PracticeReport): Promise<void> {
  const songTitle = await loadPracticeManifest(report.songId).then((song) => song.title).catch(() => report.songId)
  const entry: GrowthEntry = {
    id: report.sessionId,
    songId: report.songId,
    songTitle,
    createdAt: new Date().toISOString(),
    overallScore: report.overallScore,
    metrics: report.metrics.map(({ key, score, confidence }) => ({ key, score, confidence })),
    highlight: report.highlights[0],
    report,
  }
  const db = await openDb()
  await transaction(db, 'readwrite', (store) => store.put(entry))
}

export async function listGrowthReports(): Promise<GrowthEntry[]> {
  const db = await openDb()
  return await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll()
    request.onsuccess = () => resolve((request.result as GrowthEntry[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
    request.onerror = () => reject(request.error)
  })
}

export async function loadGrowthReport(id: string): Promise<PracticeReport | null> {
  const db = await openDb()
  return await new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    request.onsuccess = () => resolve((request.result as GrowthEntry | undefined)?.report ?? null)
    request.onerror = () => reject(request.error)
  })
}

export function buildMetricTrends(entries: GrowthEntry[]): MetricTrend[] {
  const keys: MetricKey[] = ['pitch', 'rhythm', 'breath', 'expression', 'consistency']
  return keys.map((key) => {
    const chronological = [...entries].reverse().map((entry) => entry.metrics.find((metric) => metric.key === key)).filter((metric): metric is NonNullable<typeof metric> => metric !== undefined && metric.score !== null)
    const scores = chronological.map((metric) => metric.score as number)
    const recent = scores.slice(-3)
    const previous = scores.slice(-6, -3)
    const recentAverage = average(recent)
    const previousAverage = average(previous)
    return {
      key,
      latest: scores.length ? scores[scores.length - 1] : null,
      average: average(scores),
      delta: recentAverage !== null && previousAverage !== null ? Math.round(recentAverage - previousAverage) : null,
      validSessions: scores.length,
      averageConfidence: average(chronological.map((metric) => metric.confidence)) ?? 0,
    }
  })
}

export async function clearGrowthReports(): Promise<void> {
  const db = await openDb()
  await transaction(db, 'readwrite', (store) => store.clear())
}

function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' })
      if (!request.result.objectStoreNames.contains('customSongs')) request.result.createObjectStore('customSongs', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transaction(db: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    action(tx.objectStore(STORE))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}


