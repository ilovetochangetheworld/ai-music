import type { SongManifest } from './types'

type TrackName = keyof SongManifest['assets']

export class SingAudioEngine {
  private context: AudioContext | null = null
  private buffers = new Map<TrackName, AudioBuffer>()
  private sources = new Map<TrackName, AudioBufferSourceNode>()
  private gains = new Map<TrackName, GainNode>()
  private manifest: SongManifest | null = null
  private startedAt = 0
  private offset = 0
  private pausedAt = 0
  private playing = false
  private endedCallback: (() => void) | null = null

  async load(manifest: SongManifest, onProgress?: (progress: number) => void): Promise<void> {
    await this.dispose()
    this.manifest = manifest
    const entries = Object.entries(manifest.assets) as [TrackName, string][]
    const decoder = new AudioContext()

    try {
      for (let index = 0; index < entries.length; index += 1) {
        const [name, url] = entries[index]
        const response = await fetch(url)
        if (!response.ok) throw new Error(`音轨加载失败：${name}`)
        const buffer = await decoder.decodeAudioData(await response.arrayBuffer())
        this.buffers.set(name, buffer)
        onProgress?.((index + 1) / entries.length)
      }
    } finally {
      await decoder.close()
    }
  }

  onEnded(callback: () => void): void {
    this.endedCallback = callback
  }

  async preparePlayback(): Promise<void> {
    if (!this.manifest || !this.buffers.size) throw new Error('音频尚未加载')
    if (!this.context || this.context.state === 'closed') this.context = new AudioContext({ latencyHint: 'interactive' })
    if (this.context.state !== 'running') {
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('浏览器阻止了声音播放，请确认页面可见并再次点击')), 1600)
        this.context!.resume().then(() => {
          window.clearTimeout(timer)
          resolve()
        }).catch((reason) => {
          window.clearTimeout(timer)
          reject(reason)
        })
      })
    }
    if (this.context.state !== 'running') throw new Error('浏览器没有启动音频，请再次点击开始')
  }

  async start(offsetSec = 0): Promise<void> {
    if (!this.context || !this.manifest) throw new Error('音频尚未加载')
    await this.preparePlayback()
    this.stopSources()
    this.offset = Math.max(0, Math.min(offsetSec, this.manifest.duration - 0.1))
    this.startedAt = this.context.currentTime
    this.pausedAt = 0
    this.playing = true

    const mix = this.manifest.mix
    this.createTrack('accompaniment', mix.accompanimentGain)
    this.createTrack('rescueLead', 0)
    this.createTrack('harmony', 0)
  }

  async pause(): Promise<void> {
    if (!this.context || !this.playing) return
    this.pausedAt = this.getSongTime()
    await this.context.suspend()
    this.playing = false
  }

  async resume(): Promise<void> {
    if (!this.context || !this.pausedAt) return
    await this.context.resume()
    this.startedAt = this.context.currentTime - (this.pausedAt - this.offset)
    this.playing = true
  }

  startRescue(): void {
    this.rampTrack('rescueLead', this.manifest?.mix.rescueGain ?? 0.56, 0.22)
  }

  stopRescue(): void {
    this.rampTrack('rescueLead', 0, 0.28)
  }

  setHarmonyLevel(level: number): void {
    const normalized = Math.max(0, Math.min(level, 1))
    const target = normalized * (this.manifest?.mix.harmonyGain ?? 0.25)
    this.rampTrack('harmony', target, 0.32)
  }

  playApplause(level = 0.16): void {
    if (!this.context || this.context.state !== 'running') return
    const duration = 1.15
    const sampleRate = this.context.sampleRate
    const buffer = this.context.createBuffer(2, Math.ceil(duration * sampleRate), sampleRate)
    const clapTimes = [0, 0.07, 0.15, 0.24, 0.35, 0.48, 0.64, 0.82]
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel)
      for (let index = 0; index < data.length; index += 1) {
        const time = index / sampleRate
        let envelope = 0
        for (const clapTime of clapTimes) {
          const distance = time - clapTime - channel * 0.006
          if (distance >= 0 && distance < 0.075) envelope += Math.exp(-distance * 48) * (1 - distance / 0.075)
        }
        data[index] = (Math.random() * 2 - 1) * Math.min(envelope, 1)
      }
    }
    const source = this.context.createBufferSource()
    const highpass = this.context.createBiquadFilter()
    const lowpass = this.context.createBiquadFilter()
    const gain = this.context.createGain()
    source.buffer = buffer
    highpass.type = 'highpass'
    highpass.frequency.value = 650
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 5200
    gain.gain.value = Math.max(0, Math.min(level, 0.3))
    source.connect(highpass).connect(lowpass).connect(gain).connect(this.context.destination)
    source.onended = () => {
      source.disconnect()
      highpass.disconnect()
      lowpass.disconnect()
      gain.disconnect()
    }
    source.start()
  }

  getSongTime(): number {
    if (!this.context) return this.offset
    if (!this.playing && this.pausedAt) return this.pausedAt
    return Math.min(this.manifest?.duration ?? Infinity, this.offset + this.context.currentTime - this.startedAt)
  }

  getDuration(): number {
    return this.manifest?.duration ?? 0
  }

  isPlaying(): boolean {
    return this.playing
  }

  async dispose(): Promise<void> {
    this.stopSources()
    this.buffers.clear()
    this.gains.clear()
    this.playing = false
    this.pausedAt = 0
    if (this.context && this.context.state !== 'closed') await this.context.close()
    this.context = null
  }

  private createTrack(name: TrackName, initialGain: number): void {
    if (!this.context) return
    const buffer = this.buffers.get(name)
    if (!buffer) throw new Error(`缺少音轨：${name}`)
    const source = this.context.createBufferSource()
    const gain = this.context.createGain()
    source.buffer = buffer
    gain.gain.value = initialGain
    source.connect(gain).connect(this.context.destination)
    if (name === 'accompaniment') {
      source.onended = () => {
        if (this.playing) {
          this.playing = false
          this.endedCallback?.()
        }
      }
    }
    source.start(this.context.currentTime, this.offset)
    this.sources.set(name, source)
    this.gains.set(name, gain)
  }

  private rampTrack(name: TrackName, target: number, duration: number): void {
    const gain = this.gains.get(name)
    if (!gain || !this.context) return
    const now = this.context.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(target, now + duration)
  }

  private stopSources(): void {
    for (const source of this.sources.values()) {
      source.onended = null
      try { source.stop() } catch { /* already stopped */ }
      source.disconnect()
    }
    this.sources.clear()
  }
}
