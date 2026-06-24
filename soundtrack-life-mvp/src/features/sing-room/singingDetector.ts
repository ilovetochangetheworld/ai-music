import { PitchDetector } from 'pitchy'

export interface SingingFrame {
  db: number
  pitch: number
  clarity: number
  vadProbability: number
  isSinging: boolean
}

export class SingingDetector {
  private context: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private frame = new Float32Array(2048)
  private pitchDetector = PitchDetector.forFloat32Array(2048)
  private noiseFloor = -58
  private calibrationValues: number[] = []
  private vadProbability = 0

  async start(): Promise<MediaStream> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    })
    this.context = new AudioContext({ latencyHint: 'interactive' })
    this.analyser = this.context.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.22
    this.source = this.context.createMediaStreamSource(this.stream)
    this.source.connect(this.analyser)
    return this.stream
  }

  beginCalibration(): void {
    this.calibrationValues = []
  }

  captureCalibrationFrame(): void {
    const db = this.readDb()
    if (Number.isFinite(db)) this.calibrationValues.push(db)
  }

  finishCalibration(): number {
    if (this.calibrationValues.length) {
      const sorted = [...this.calibrationValues].sort((a, b) => a - b)
      this.noiseFloor = sorted[Math.floor(sorted.length * 0.75)] ?? -58
    }
    return this.noiseFloor
  }

  setVadProbability(probability: number): void {
    this.vadProbability = probability
  }

  read(): SingingFrame {
    if (!this.analyser || !this.context) {
      return { db: -100, pitch: 0, clarity: 0, vadProbability: 0, isSinging: false }
    }
    this.analyser.getFloatTimeDomainData(this.frame)
    const db = calculateDb(this.frame)
    const [pitch, clarity] = this.pitchDetector.findPitch(this.frame, this.context.sampleRate)
    const energyActive = db > Math.max(-48, this.noiseFloor + 10)
    const pitched = clarity > 0.72 && pitch >= 70 && pitch <= 1100
    const isSinging = energyActive && (pitched || this.vadProbability > 0.65)
    return { db, pitch, clarity, vadProbability: this.vadProbability, isSinging }
  }

  getNoiseFloor(): number {
    return this.noiseFloor
  }

  getEstimatedInputLatencySec(): number {
    if (!this.context || !this.analyser) return .12
    const analysisWindowCenter = this.analyser.fftSize / this.context.sampleRate / 2
    return Math.max(.06, this.context.baseLatency + analysisWindowCenter)
  }

  async dispose(): Promise<void> {
    this.source?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    if (this.context && this.context.state !== 'closed') await this.context.close()
    this.context = null
    this.analyser = null
    this.source = null
    this.stream = null
  }

  private readDb(): number {
    if (!this.analyser) return -100
    this.analyser.getFloatTimeDomainData(this.frame)
    return calculateDb(this.frame)
  }
}

function calculateDb(frame: Float32Array): number {
  let sum = 0
  for (const sample of frame) sum += sample * sample
  const rms = Math.sqrt(sum / frame.length)
  return rms > 0 ? 20 * Math.log10(rms) : -100
}
