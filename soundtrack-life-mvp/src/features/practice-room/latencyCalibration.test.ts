import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectiveLatencySec, estimateLatencyCalibration, loadLatencyCalibration, saveLatencyCalibration } from './latencyCalibration'

describe('设备延迟校准', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.stubGlobal('sessionStorage', memoryStorage())
  })

  it('使用中位数并忽略异常样本', () => {
    const result = estimateLatencyCalibration([
      { beatAtSec: 1, detectedAtSec: 1.1 },
      { beatAtSec: 2, detectedAtSec: 2.11 },
      { beatAtSec: 3, detectedAtSec: 3.1 },
      { beatAtSec: 4, detectedAtSec: 4.09 },
      { beatAtSec: 5, detectedAtSec: 5.105 },
      { beatAtSec: 6, detectedAtSec: 6.8 },
    ], 48000, new Date('2026-06-22T00:00:00.000Z'))
    expect(result.offsetMs).toBe(100)
    expect(result.sampleCount).toBe(5)
    expect(result.confidence).toBe('high')
    expect(result.status).toBe('valid')
  })

  it('样本不足时不启用补偿', () => {
    const result = estimateLatencyCalibration([
      { beatAtSec: 1, detectedAtSec: 1.1 },
      { beatAtSec: 2, detectedAtSec: 2.1 },
    ], 44100)
    expect(result.status).toBe('low_confidence')
    expect(effectiveLatencySec(result, .08)).toBe(.08)
  })

  it('本地结果过期后不再复用', () => {
    const result = estimateLatencyCalibration([
      { beatAtSec: 1, detectedAtSec: 1.1 }, { beatAtSec: 2, detectedAtSec: 2.1 },
      { beatAtSec: 3, detectedAtSec: 3.1 }, { beatAtSec: 4, detectedAtSec: 4.1 },
      { beatAtSec: 5, detectedAtSec: 5.1 },
    ], 48000, new Date('2026-01-01T00:00:00.000Z'))
    saveLatencyCalibration(result)
    expect(loadLatencyCalibration(new Date('2026-01-15T00:00:00.000Z'))).not.toBeNull()
    expect(loadLatencyCalibration(new Date('2026-02-15T00:00:00.000Z'))).toBeNull()
  })
})

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key) },
    setItem: (key, value) => { values.set(key, value) },
  }
}
