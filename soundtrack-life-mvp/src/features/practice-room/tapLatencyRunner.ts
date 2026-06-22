import { estimateLatencyCalibration, type LatencyTapSample } from './latencyCalibration'
import type { DeviceLatencyCalibration } from '../../../shared/contracts'

export interface TapCalibrationProgress {
  beat: number
  total: number
  detected: number
  phase: 'noise' | 'count_in' | 'tapping'
}

const COUNT_IN = 2
const TAP_COUNT = 6
const INTERVAL_SEC = .72

export async function runTapLatencyCalibration(
  onProgress: (progress: TapCalibrationProgress) => void,
  signal?: AbortSignal,
): Promise<DeviceLatencyCalibration> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  })
  const context = new AudioContext({ latencyHint: 'interactive' })
  await context.resume()
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  analyser.smoothingTimeConstant = 0
  const source = context.createMediaStreamSource(stream)
  source.connect(analyser)
  const frame = new Float32Array(new ArrayBuffer(analyser.fftSize * Float32Array.BYTES_PER_ELEMENT))
  const noiseReadings: number[] = []
  const samples: LatencyTapSample[] = []
  const used = new Set<number>()
  let timer: number | null = null

  try {
    onProgress({ beat: 0, total: TAP_COUNT, detected: 0, phase: 'noise' })
    const baselineUntil = context.currentTime + .65
    while (context.currentTime < baselineUntil) {
      assertActive(signal)
      noiseReadings.push(readDb(analyser, frame))
      await wait(20)
    }
    const sortedNoise = noiseReadings.filter(Number.isFinite).sort((a, b) => a - b)
    const noiseFloor = sortedNoise[Math.floor(sortedNoise.length * .75)] ?? -58
    const threshold = Math.max(-42, noiseFloor + 14)
    const firstBeat = context.currentTime + .9
    const allBeats = Array.from({ length: COUNT_IN + TAP_COUNT }, (_, index) => firstBeat + index * INTERVAL_SEC)
    allBeats.forEach((at, index) => scheduleClick(context, at, index >= COUNT_IN ? 1150 : 760))
    let lastDetectedAt = -1

    await new Promise<void>((resolve, reject) => {
      timer = window.setInterval(() => {
        try {
          assertActive(signal)
          const now = context.currentTime
          const measuredBeats = allBeats.slice(COUNT_IN)
          const activeBeat = measuredBeats.filter((beat) => now >= beat).length
          onProgress({
            beat: Math.min(TAP_COUNT, activeBeat), total: TAP_COUNT, detected: samples.length,
            phase: now < measuredBeats[0] ? 'count_in' : 'tapping',
          })
          const db = readDb(analyser, frame)
          if (db >= threshold && now - lastDetectedAt >= .16) {
            const candidate = measuredBeats
              .map((beat, index) => ({ beat, index, offset: now - beat }))
              .filter((item) => !used.has(item.index) && item.offset >= 0 && item.offset <= .45)
              .sort((a, b) => Math.abs(a.offset) - Math.abs(b.offset))[0]
            if (candidate) {
              used.add(candidate.index)
              samples.push({ beatAtSec: candidate.beat, detectedAtSec: now })
              lastDetectedAt = now
            }
          }
          if (now >= measuredBeats[measuredBeats.length - 1] + .55) resolve()
        } catch (error) {
          reject(error)
        }
      }, 12)
    })
    return estimateLatencyCalibration(samples, context.sampleRate)
  } finally {
    if (timer !== null) window.clearInterval(timer)
    source.disconnect()
    stream.getTracks().forEach((track) => track.stop())
    await context.close().catch(() => undefined)
  }
}

function scheduleClick(context: AudioContext, at: number, frequency: number) {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(.0001, at)
  gain.gain.exponentialRampToValueAtTime(.34, at + .004)
  gain.gain.exponentialRampToValueAtTime(.0001, at + .055)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(at)
  oscillator.stop(at + .06)
}

function readDb(analyser: AnalyserNode, frame: Float32Array<ArrayBuffer>): number {
  analyser.getFloatTimeDomainData(frame)
  let sum = 0
  for (const sample of frame) sum += sample * sample
  const rms = Math.sqrt(sum / frame.length)
  return rms > 0 ? 20 * Math.log10(rms) : -100
}

function assertActive(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('校准已取消', 'AbortError')
}

function wait(ms: number) { return new Promise((resolve) => window.setTimeout(resolve, ms)) }
