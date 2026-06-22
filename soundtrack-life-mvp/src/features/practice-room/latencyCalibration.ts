import type { DeviceLatencyCalibration } from '../../../shared/contracts'

export interface LatencyTapSample {
  beatAtSec: number
  detectedAtSec: number
}

const STORAGE_KEY = 'ai-practice-latency-calibration-v1'
const SKIP_KEY = 'ai-practice-latency-skip'
const MAX_CORRECTION_MS = 250
const VALID_DAYS = 30

export function estimateLatencyCalibration(
  samples: LatencyTapSample[],
  sampleRateHz: number,
  now = new Date(),
): DeviceLatencyCalibration {
  const offsets = samples
    .map((sample) => (sample.detectedAtSec - sample.beatAtSec) * 1000)
    .filter((offset) => Number.isFinite(offset) && offset >= 0 && offset <= 450)
  const rawOffset = median(offsets) ?? 0
  const jitter = median(offsets.map((offset) => Math.abs(offset - rawOffset))) ?? 0
  const enough = offsets.length >= 4
  const confidence = offsets.length >= 5 && jitter <= 25
    ? 'high'
    : enough && jitter <= 50
      ? 'medium'
      : 'low'
  const status = confidence !== 'low' && rawOffset <= MAX_CORRECTION_MS ? 'valid' : 'low_confidence'
  const expiresAt = new Date(now)
  expiresAt.setDate(expiresAt.getDate() + VALID_DAYS)
  return {
    version: '1.0',
    method: 'user_tap',
    offsetMs: Math.round(Math.min(MAX_CORRECTION_MS, Math.max(0, rawOffset))),
    jitterMs: Math.round(Math.max(0, jitter)),
    sampleCount: offsets.length,
    confidence,
    status,
    sampleRateHz,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}

export function saveLatencyCalibration(calibration: DeviceLatencyCalibration): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration))
  sessionStorage.removeItem(SKIP_KEY)
}

export function loadLatencyCalibration(now = new Date()): DeviceLatencyCalibration | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<DeviceLatencyCalibration> | null
    if (!parsed || parsed.version !== '1.0' || parsed.method !== 'user_tap') return null
    if (!Number.isFinite(parsed.offsetMs) || !Number.isFinite(parsed.jitterMs) || !Number.isFinite(parsed.sampleCount)) return null
    if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() <= now.getTime()) return null
    if (!['high', 'medium', 'low'].includes(parsed.confidence ?? '')) return null
    if (!['valid', 'low_confidence'].includes(parsed.status ?? '')) return null
    return parsed as DeviceLatencyCalibration
  } catch {
    return null
  }
}

export function clearLatencyCalibration(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function markLatencyCalibrationSkipped(): void {
  sessionStorage.setItem(SKIP_KEY, '1')
}

export function latencyCalibrationSkippedThisSession(): boolean {
  return sessionStorage.getItem(SKIP_KEY) === '1'
}

export function effectiveLatencySec(calibration: DeviceLatencyCalibration | null, fallbackSec: number): number {
  return calibration?.status === 'valid' ? calibration.offsetMs / 1000 : fallbackSec
}

function median(values: number[]): number | null {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
