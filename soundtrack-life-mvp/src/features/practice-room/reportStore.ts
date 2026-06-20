import type { PracticeReport } from '../../../shared/contracts'

const key = (songId: string) => `practice-report:${songId}`

export function savePracticeReport(report: PracticeReport): void {
  sessionStorage.setItem(key(report.songId), JSON.stringify(report))
}

export function loadPracticeReport(songId: string): PracticeReport | null {
  try {
    const value = sessionStorage.getItem(key(songId))
    return value ? JSON.parse(value) as PracticeReport : null
  } catch { return null }
}
