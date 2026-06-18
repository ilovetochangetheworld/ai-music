export interface SessionRecording {
  blob: Blob
  url: string
  mimeType: string
  durationSec: number
}

let currentRecording: SessionRecording | null = null

export function saveSessionRecording(blob: Blob, durationSec: number): SessionRecording {
  deleteSessionRecording()
  currentRecording = {
    blob,
    url: URL.createObjectURL(blob),
    mimeType: blob.type || 'audio/webm',
    durationSec,
  }
  return currentRecording
}

export function loadSessionRecording(): SessionRecording | null {
  return currentRecording
}

export function deleteSessionRecording(): void {
  if (currentRecording) URL.revokeObjectURL(currentRecording.url)
  currentRecording = null
}

export function preferredRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return [
    'audio/webm;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/webm',
    'audio/mp4',
  ].find((type) => MediaRecorder.isTypeSupported(type))
}
