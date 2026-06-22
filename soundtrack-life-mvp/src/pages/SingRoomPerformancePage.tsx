import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MicVAD } from '@ricky0123/vad-web'
import { Headphones, Mic2, Pause, Play, Radio, SkipForward, Sparkles, Volume1, Volume2 } from 'lucide-react'
import { SingAudioEngine } from '../features/sing-room/audioEngine'
import { SingingDetector, type SingingFrame } from '../features/sing-room/singingDetector'
import { buildRecap, saveRecap } from '../features/sing-room/recap'
import { deleteSessionRecording, preferredRecordingMimeType, saveSessionRecording } from '../features/sing-room/recording'
import { formatTime, loadPracticeSong, loadSettings } from '../features/sing-room/session'
import type { LyricLine, SingEvent, SongManifest, SongTimeline, VocalFrameSample } from '../features/sing-room/types'
import { buildLocalPracticeReport } from '../features/practice-room/scoring'
import { savePracticeReport } from '../features/practice-room/reportStore'
import { saveGrowthReport } from '../features/practice-room/growth'
import { loadPracticeManifest } from '../features/practice-room/catalog'
import { reviewedReferenceNotes, type ReferenceNotesFile } from '../features/practice-room/referenceNotes'
import { buildEstimatedReferenceTrack } from '../features/practice-room/referenceTrack'
import { RealtimeGuidanceTracker, type GuidanceResult, type PitchGuidanceState } from '../features/practice-room/realtimeGuidance'
import { effectiveLatencySec, loadLatencyCalibration } from '../features/practice-room/latencyCalibration'
import type { ReferenceNote, ReferenceTrack } from '../../shared/contracts'
import XiaoMai from '../components/XiaoMai'
import ortWasmUrl from '../assets/vad/ort-wasm-simd-threaded.wasm?url'
import ortMjsUrl from '../assets/vad/ort-wasm-simd-threaded.mjs?url'

type Phase = 'loading' | 'ready' | 'calibrating' | 'countdown' | 'singing' | 'paused' | 'error'

const EMPTY_FRAME: SingingFrame = { db: -100, pitch: 0, clarity: 0, vadProbability: 0, isSinging: false }
const EMPTY_GUIDANCE: GuidanceResult = { pitchState: 'idle', pitchLabel: '等你开口', timingState: 'unavailable', timingLabel: '逐字节奏待审核', centsError: null, normalizedMidi: null, targetNoteId: null, confidence: 0 }
interface PitchTrailPoint { at: number; midi: number; state: PitchGuidanceState }

export default function SingRoomPerformancePage() {
  const { songId = 'trajectory' } = useParams()
  const navigate = useNavigate()
  const settings = useRef(loadSettings()).current
  const latencyCalibration = useRef(loadLatencyCalibration()).current
  const [phase, setPhaseState] = useState<Phase>('loading')
  const phaseRef = useRef<Phase>('loading')
  const [loadProgress, setLoadProgress] = useState(0)
  const [calibrationProgress, setCalibrationProgress] = useState(0)
  const [countdown, setCountdown] = useState(3)
  const [songTime, setSongTime] = useState(0)
  const [frame, setFrame] = useState<SingingFrame>(EMPTY_FRAME)
  const [currentLine, setCurrentLine] = useState<LyricLine | null>(null)
  const [nextLine, setNextLine] = useState<LyricLine | null>(null)
  const [rescuing, setRescuing] = useState(false)
  const [hostMessage, setHostMessage] = useState('第一段你先来，副歌我们一起。')
  const [error, setError] = useState('')
  const [vadError, setVadError] = useState('')
  const [recordingActive, setRecordingActive] = useState(false)
  const [referenceTrack, setReferenceTrack] = useState<ReferenceTrack | null>(null)
  const [guidance, setGuidance] = useState<GuidanceResult>(EMPTY_GUIDANCE)
  const [pitchTrail, setPitchTrail] = useState<PitchTrailPoint[]>([])
  const [applauding, setApplauding] = useState(false)
  const [crowdReaction, setCrowdReaction] = useState('小麦已就位 · 等你开口')
  const manifestRef = useRef<SongManifest | null>(null)
  const timelineRef = useRef<SongTimeline | null>(null)
  const engineRef = useRef<SingAudioEngine | null>(null)
  const detectorRef = useRef<SingingDetector | null>(null)
  const monitorRef = useRef<number | null>(null)
  const eventsRef = useRef<SingEvent[]>([])
  const sessionStartRef = useRef(0)
  const vadProbabilityRef = useRef(0)
  const vadRef = useRef<MicVAD | null>(null)
  const userHasSungRef = useRef(false)
  const currentSingingRef = useRef(false)
  const silenceSinceRef = useRef<number | null>(null)
  const resumeSinceRef = useRef<number | null>(null)
  const rescueActiveRef = useRef(false)
  const lastRescueAtRef = useRef(-10)
  const harmonyActiveRef = useRef(false)
  const previousLineRef = useRef<LyricLine | null>(null)
  const previousSectionRef = useRef<string | null>(null)
  const currentLineRef = useRef<LyricLine | null>(null)
  const samplesRef = useRef<VocalFrameSample[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingChunksRef = useRef<Blob[]>([])
  const finishingRef = useRef(false)
  const referenceNotesRef = useRef<ReferenceNote[]>([])
  const referenceTrackRef = useRef<ReferenceTrack | null>(null)
  const guidanceTrackerRef = useRef(new RealtimeGuidanceTracker(.12))
  const applauseCountRef = useRef(0)
  const lastApplauseAtRef = useRef(-20)
  const applauseTimerRef = useRef<number | null>(null)
  const crowdTimerRef = useRef<number | null>(null)

  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])

  const addEvent = useCallback((event: SingEvent) => {
    eventsRef.current = [...eventsRef.current, event]
  }, [])

  const triggerCrowd = useCallback((message: string, level: number, duration = 1600) => {
    engineRef.current?.playApplause(level)
    setApplauding(true)
    setCrowdReaction(message)
    if (applauseTimerRef.current) window.clearTimeout(applauseTimerRef.current)
    if (crowdTimerRef.current) window.clearTimeout(crowdTimerRef.current)
    applauseTimerRef.current = window.setTimeout(() => setApplauding(false), duration)
    crowdTimerRef.current = window.setTimeout(() => setCrowdReaction('小麦正在听'), duration + 700)
  }, [])

  const finishSession = useCallback(async () => {
    if (finishingRef.current) return
    const timeline = timelineRef.current
    const engine = engineRef.current
    if (!timeline || !engine) return
    finishingRef.current = true
    const end = engine.getSongTime()
    if (monitorRef.current) window.clearInterval(monitorRef.current)
    const completedEvents = [...eventsRef.current]
    if (currentSingingRef.current) completedEvents.push({ type: 'USER_STOPPED', at: end, silenceMs: 0 })
    completedEvents.push({ type: 'SONG_COMPLETED', at: end })
    eventsRef.current = completedEvents
    const recording = await stopRecording()
    if (recording && settings.retainRecording) saveSessionRecording(recording, Math.max(0, end - sessionStartRef.current))
    const relevantLines = timeline.lines.filter((line) => line.end >= sessionStartRef.current && line.start <= end)
    const recap = buildRecap(completedEvents, relevantLines, end, samplesRef.current, sessionStartRef.current)
    recap.recordingAvailable = Boolean(recording && settings.retainRecording)
    saveRecap(recap)
    const report = buildLocalPracticeReport({
      sessionId: crypto.randomUUID(), songId, lines: relevantLines,
      noiseFloorDb: detectorRef.current?.getNoiseFloor() ?? -58,
      notes: referenceNotesRef.current,
      latencyCalibration,
      frames: samplesRef.current.map((sample) => ({ at: sample.at, db: sample.db, pitchHz: sample.pitch, clarity: sample.clarity, vadProbability: vadProbabilityRef.current, isSinging: sample.isSinging })),
    })
    savePracticeReport(report)
    void saveGrowthReport(report).catch(() => undefined)
    navigate(`/practice/${songId}/recap`)
  }, [latencyCalibration, navigate, settings, songId])

  useEffect(() => {
    let cancelled = false
    const engine = new SingAudioEngine()
    engineRef.current = engine
    engine.onEnded(() => { void finishSession() })

    loadPracticeSong(songId)
      .then(async ({ manifest, timeline }) => {
        if (cancelled) return
        manifestRef.current = manifest
        timelineRef.current = timeline
        void loadPracticeManifest(songId).then(async (practiceManifest) => {
          const response = await fetch(`${import.meta.env.BASE_URL}${practiceManifest.assets.notes}`)
          const data = response.ok ? await response.json() as ReferenceNotesFile : null
          referenceNotesRef.current = reviewedReferenceNotes(data)
          referenceTrackRef.current = buildEstimatedReferenceTrack(referenceNotesRef.current, timeline.lines)
          setReferenceTrack(referenceTrackRef.current)
        }).catch(() => { referenceNotesRef.current = []; referenceTrackRef.current = null; setReferenceTrack(null) })
        await engine.load(manifest, setLoadProgress)
        if (!cancelled) setPhase('ready')
      })
      .catch((reason: unknown) => {
        if (cancelled) return
        setError(reason instanceof Error ? reason.message : '音轨加载失败')
        setPhase('error')
      })

    return () => {
      cancelled = true
      if (monitorRef.current) window.clearInterval(monitorRef.current)
      if (applauseTimerRef.current) window.clearTimeout(applauseTimerRef.current)
      if (crowdTimerRef.current) window.clearTimeout(crowdTimerRef.current)
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
      void engine.dispose()
      void detectorRef.current?.dispose()
      if (vadRef.current) void vadRef.current.destroy().catch(() => undefined)
    }
  }, [finishSession, setPhase, songId])

  useEffect(() => {
    if (!recordingActive) return
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warnBeforeLeave)
    return () => window.removeEventListener('beforeunload', warnBeforeLeave)
  }, [recordingActive])

  const stopRescue = useCallback((recovered: boolean) => {
    if (!rescueActiveRef.current) return
    const now = engineRef.current?.getSongTime() ?? songTime
    engineRef.current?.stopRescue()
    rescueActiveRef.current = false
    resumeSinceRef.current = null
    setRescuing(false)
    addEvent({ type: 'RESCUE_ENDED', at: now, recovered })
    if (recovered) {
      setHostMessage('接住了，后面继续交给你。')
      triggerCrowd('接回来了！主唱还是你', settings.interactionLevel === 'lively' ? 0.15 : settings.interactionLevel === 'balanced' ? 0.1 : 0)
    }
  }, [addEvent, settings.interactionLevel, songTime, triggerCrowd])

  const startRescue = useCallback((source: 'auto' | 'manual') => {
    const engine = engineRef.current
    const line = currentLineRef.current
    if (!engine || !line || rescueActiveRef.current) return
    const now = engine.getSongTime()
    engine.startRescue()
    rescueActiveRef.current = true
    lastRescueAtRef.current = now
    setRescuing(true)
    setHostMessage(source === 'manual' ? '这句小麦来，你准备好再接。' : '没关系，小麦先帮你托住。')
    addEvent({ type: 'RESCUE_STARTED', at: now, lineId: line.id, source })
  }, [addEvent])

  const beginMonitor = useCallback(() => {
    if (monitorRef.current) window.clearInterval(monitorRef.current)
    monitorRef.current = window.setInterval(() => {
      if (phaseRef.current !== 'singing') return
      const engine = engineRef.current
      const detector = detectorRef.current
      const timeline = timelineRef.current
      if (!engine || !timeline) return

      detector?.setVadProbability(vadProbabilityRef.current)
      const nextFrame = detector?.read() ?? EMPTY_FRAME
      const now = engine.getSongTime()
      const lineIndex = timeline.lines.findIndex((line) => now >= line.start && now < line.end)
      const line = lineIndex >= 0 ? timeline.lines[lineIndex] : null
      setSongTime(now)
      setFrame(nextFrame)
      const nextGuidance = referenceTrackRef.current ? guidanceTrackerRef.current.update({ songTime: now, pitchHz: nextFrame.pitch, clarity: nextFrame.clarity, isSinging: nextFrame.isSinging }, referenceTrackRef.current) : EMPTY_GUIDANCE
      setGuidance(nextGuidance)
      setPitchTrail((current) => {
        const recent = current.filter((point) => point.at >= now - 1.1)
        return nextGuidance.normalizedMidi === null ? recent : [...recent, { at: now, midi: nextGuidance.normalizedMidi, state: nextGuidance.pitchState }]
      })
      if (detector) samplesRef.current.push({ at: now, db: nextFrame.db, pitch: nextFrame.pitch, clarity: nextFrame.clarity, isSinging: nextFrame.isSinging })
      setCurrentLine(line)
      currentLineRef.current = line
      setNextLine(lineIndex >= 0 ? timeline.lines[lineIndex + 1] ?? null : null)

      const shouldHarmony = Boolean(line?.harmonyEnabled) && settings.interactionLevel !== 'quiet'
      if (shouldHarmony !== harmonyActiveRef.current) {
        harmonyActiveRef.current = shouldHarmony
        engine.setHarmonyLevel(shouldHarmony ? settings.harmonyLevel : 0)
      }

      if (line?.section === 'chorus' && previousSectionRef.current !== 'chorus') {
        triggerCrowd('副歌来了 · 一起唱！', settings.interactionLevel === 'lively' ? 0.13 : settings.interactionLevel === 'balanced' ? 0.08 : 0, 1400)
      }
      previousSectionRef.current = line?.section ?? previousSectionRef.current

      if (previousLineRef.current && previousLineRef.current.id !== line?.id && currentSingingRef.current && previousLineRef.current.section === 'chorus') {
        addEvent({ type: 'HIGHLIGHT_COMPLETED', at: now, lineId: previousLineRef.current.id })
        const applauseBudget = settings.interactionLevel === 'lively' ? 2 : settings.interactionLevel === 'balanced' ? 1 : 0
        if (applauseCountRef.current < applauseBudget && now - lastApplauseAtRef.current >= 18) {
          applauseCountRef.current += 1
          lastApplauseAtRef.current = now
          triggerCrowd('这一句唱完整了！', settings.interactionLevel === 'lively' ? 0.22 : 0.16)
        }
      }
      previousLineRef.current = line

      if (nextFrame.isSinging) {
        silenceSinceRef.current = null
        if (!currentSingingRef.current) {
          currentSingingRef.current = true
          userHasSungRef.current = true
          addEvent({ type: 'USER_STARTED', at: now })
        }
        if (rescueActiveRef.current) {
          resumeSinceRef.current ??= performance.now()
          if (performance.now() - resumeSinceRef.current >= 300) {
            addEvent({ type: 'USER_RESUMED', at: now })
            stopRescue(true)
          }
        }
      } else {
        resumeSinceRef.current = null
        silenceSinceRef.current ??= performance.now()
        const silenceMs = performance.now() - silenceSinceRef.current
        if (currentSingingRef.current && silenceMs >= 450) {
          currentSingingRef.current = false
          addEvent({ type: 'USER_STOPPED', at: now, silenceMs })
        }
        const awayFromLineEnd = line ? line.end - now > line.breathProtectionMs / 1000 : false
        if (
          settings.autoRescue && line?.rescuable && userHasSungRef.current && awayFromLineEnd &&
          silenceMs >= 1600 && now - lastRescueAtRef.current >= 4 && !rescueActiveRef.current
        ) startRescue('auto')
      }
    }, 80)
  }, [addEvent, settings, startRescue, stopRescue, triggerCrowd])

  function beginRecording(stream: MediaStream) {
    if (typeof MediaRecorder === 'undefined') return
    try {
      const mimeType = preferredRecordingMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recordingChunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data)
      }
      recorder.onerror = () => setRecordingActive(false)
      recorderRef.current = recorder
      recorder.start(250)
      setRecordingActive(true)
    } catch {
      recorderRef.current = null
      setRecordingActive(false)
    }
  }

  function stopRecording(): Promise<Blob | null> {
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return Promise.resolve(null)
    return new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        const blob = recordingChunksRef.current.length
          ? new Blob(recordingChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
          : null
        recorderRef.current = null
        recordingChunksRef.current = []
        setRecordingActive(false)
        resolve(blob)
      }
      const fail = () => {
        if (settled) return
        settled = true
        window.clearTimeout(timeout)
        recorderRef.current = null
        recordingChunksRef.current = []
        setRecordingActive(false)
        resolve(null)
      }
      const timeout = window.setTimeout(fail, 1800)
      recorder.addEventListener('stop', finish, { once: true })
      recorder.addEventListener('error', fail, { once: true })
      recorder.stop()
    })
  }

  async function calibrateAndStart() {
    try {
      setPhase('calibrating')
      setCalibrationProgress(0)
      const detector = new SingingDetector()
      detectorRef.current = detector
      const engine = engineRef.current
      if (!engine) throw new Error('音频尚未加载')
      const [stream] = await Promise.all([detector.start(), engine.preparePlayback()])
      guidanceTrackerRef.current.setLatencyCompensation(effectiveLatencySec(latencyCalibration, detector.getEstimatedInputLatencySec()))
      deleteSessionRecording()
      detector.beginCalibration()
      void startOptionalVad()
      const started = performance.now()
      await new Promise<void>((resolve) => {
        const timer = window.setInterval(() => {
          detector.captureCalibrationFrame()
          const progress = Math.min(1, (performance.now() - started) / 3000)
          setCalibrationProgress(progress)
          if (progress >= 1) {
            window.clearInterval(timer)
            resolve()
          }
        }, 50)
      })
      detector.finishCalibration()
      const timeline = timelineRef.current!
      const offset = settings.demoMode ? timeline.demoCueSec : 0
      const firstLineIndex = timeline.lines.findIndex((line) => line.end > offset)
      const firstLine = firstLineIndex >= 0 ? timeline.lines[firstLineIndex] : null
      sessionStartRef.current = offset
      setSongTime(offset)
      setCurrentLine(firstLine)
      currentLineRef.current = firstLine
      setNextLine(firstLineIndex >= 0 ? timeline.lines[firstLineIndex + 1] ?? null : null)
      setHostMessage('第一句看好了，倒数后你先来。')
      setCrowdReaction('安静一下 · 主唱要开口了')
      setPhase('countdown')
      for (let value = 3; value > 0; value -= 1) {
        setCountdown(value)
        await new Promise((resolve) => window.setTimeout(resolve, 700))
      }
      eventsRef.current = []
      samplesRef.current = []
      applauseCountRef.current = 0
      lastApplauseAtRef.current = -20
      previousSectionRef.current = null
      beginRecording(stream)
      await engine.start(offset)
      addEvent({ type: 'SONG_STARTED', at: offset })
      setSongTime(offset)
      setPhase('singing')
      beginMonitor()
    } catch (reason) {
      await stopRecording()
      setError(reason instanceof Error ? reason.message : '麦克风启动失败')
      setPhase('error')
    }
  }

  async function startOptionalVad() {
    try {
      setVadError('')
      const base = import.meta.env.BASE_URL
      const instance = await MicVAD.new({
        model: 'v5',
        startOnLoad: false,
        processorType: 'ScriptProcessor',
        baseAssetPath: `${base}vad/`,
        onnxWASMBasePath: '',
        ortConfig: (ort) => {
          ort.env.wasm.numThreads = 1
          ort.env.wasm.wasmPaths = {
            wasm: new URL(ortWasmUrl, window.location.href).href,
            mjs: new URL(ortMjsUrl, window.location.href).href,
          }
        },
        positiveSpeechThreshold: 0.65,
        negativeSpeechThreshold: 0.45,
        redemptionMs: 550,
        minSpeechMs: 180,
        onFrameProcessed: (probabilities) => { vadProbabilityRef.current = probabilities.isSpeech },
      })
      vadRef.current = instance
      await instance.start()
    } catch (reason) {
      setVadError(reason instanceof Error ? reason.message : 'Silero VAD 未启用')
    }
  }

  async function startWithoutMic() {
    const timeline = timelineRef.current
    const engine = engineRef.current
    if (!timeline || !engine) return
    const offset = settings.demoMode ? timeline.demoCueSec : 0
    sessionStartRef.current = offset
    eventsRef.current = []
    samplesRef.current = []
    applauseCountRef.current = 0
    lastApplauseAtRef.current = -20
    previousSectionRef.current = null
    deleteSessionRecording()
    try {
      setError('')
      await engine.start(offset)
      addEvent({ type: 'SONG_STARTED', at: offset })
      setSongTime(offset)
      setHostMessage('先用手动接唱试玩，点“帮我接”就把这一句交给小麦。')
      setPhase('singing')
      beginMonitor()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '浏览器没有启动音频')
      setPhase('error')
    }
  }

  async function togglePause() {
    if (phase === 'singing') {
      await engineRef.current?.pause()
      if (recorderRef.current?.state === 'recording') recorderRef.current.pause()
      setPhase('paused')
    } else if (phase === 'paused') {
      await engineRef.current?.resume()
      if (recorderRef.current?.state === 'paused') recorderRef.current.resume()
      setPhase('singing')
    }
  }

  const timeline = timelineRef.current
  const duration = timeline?.duration ?? manifestRef.current?.duration ?? 0
  const section = timeline?.sections.find((item) => songTime >= item.start && songTime < item.end)
  const progress = duration ? songTime / duration : 0
  const meter = Math.max(0, Math.min(1, (frame.db + 58) / 42))

  return (
    <main className={applauding ? 'sing-stage crowd-live' : 'sing-stage'}>
      <div className="stage-ambient" aria-hidden="true" />
      <header className="stage-topbar">
        <div><span className="live-dot" />AI 练歌房 {recordingActive && <small className="recording-indicator">录音中</small>}</div>
        <span>{section?.label ?? '准备中'}</span>
        <button className="stage-end" onClick={() => void finishSession()} disabled={!['singing', 'paused'].includes(phase)}>结束演唱</button>
      </header>

      <section className="stage-main">
        <div className="friend-rail single-companion" aria-label="小麦陪练状态">
          <XiaoMai compact state={applauding ? 'cheering' : frame.isSinging ? 'listening' : rescuing ? 'cheering' : 'waiting'} />
          <b>小麦</b><small>{rescuing ? '接唱中' : applauding ? '为你鼓掌' : frame.isSinging ? '正在听' : '安静陪着你'}</small>
        </div>

        <div className="lyric-stage">
          <AnimatePresence mode="wait">
            <motion.p key={currentLine?.id ?? 'waiting'} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="current-lyric">
              {currentLine?.text ?? (phase === 'ready' ? '戴好耳机，准备开口。' : '♪')}
            </motion.p>
          </AnimatePresence>
          <p className="next-lyric">{nextLine?.text ?? ' '}</p>
          <ReferenceGuide at={songTime} track={referenceTrack} trail={pitchTrail} guidance={guidance} />
          <AnimatePresence>
            {hostMessage && phase !== 'loading' && (
              <motion.div className="host-bubble" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
                <b>小麦</b>{hostMessage}
              </motion.div>
            )}
          </AnimatePresence>
          <div className={applauding ? 'crowd-presence active' : 'crowd-presence'} aria-live="polite">
            <span className="crowd-bars" aria-hidden="true"><i /><i /><i /><i /></span>
            <b>小麦</b><span>{crowdReaction}</span>
          </div>
        </div>

        <div className="voice-state">
          <span className={frame.isSinging ? 'voice-orb active' : 'voice-orb'}><Mic2 size={23} /></span>
          <div><b>{rescuing ? '小麦正在接唱' : frame.isSinging ? '小麦听见你了' : '等你开口'}</b><small>{settings.practiceMode === 'free' ? '自由唱 · 唱后再分析' : '专项练习 · 一句结束后轻提示'}</small></div>
          <span className="voice-meter"><i style={{ width: `${meter * 100}%` }} /></span>
        </div>
      </section>

      <footer className="stage-controls">
        <div className="stage-progress"><i style={{ width: `${progress * 100}%` }} /></div>
        <div className="stage-time mono"><span>{formatTime(songTime)}</span><span>{formatTime(duration)}</span></div>
        <div className="stage-command-row">
          <button className="icon-command" title={phase === 'paused' ? '继续' : '暂停'} onClick={togglePause} disabled={!['singing', 'paused'].includes(phase)}>
            {phase === 'paused' ? <Play size={20} /> : <Pause size={20} />}
          </button>
          <button className={rescuing ? 'rescue-command active' : 'rescue-command'} onClick={() => rescuing ? stopRescue(true) : startRescue('manual')} disabled={phase !== 'singing'}>
            <SkipForward size={20} /><span>{rescuing ? '我来接回' : '帮我接'}</span>
          </button>
          <button className="icon-command" title="切换和声" onClick={() => {
            harmonyActiveRef.current = !harmonyActiveRef.current
            engineRef.current?.setHarmonyLevel(harmonyActiveRef.current ? settings.harmonyLevel : 0)
          }} disabled={phase !== 'singing'}>
            {harmonyActiveRef.current ? <Volume2 size={20} /> : <Volume1 size={20} />}
          </button>
        </div>
      </footer>

      <AnimatePresence>
        {phase === 'loading' && <StageOverlay icon={<Radio />} title="正在布置包厢" detail={`加载三条同步音轨 ${Math.round(loadProgress * 100)}%`} progress={loadProgress} />}
        {phase === 'ready' && <StageOverlay icon={<Headphones />} title="戴好耳机" detail="授权麦克风后会校准环境，并在演唱开始时录音" action={<button className="sing-primary-command" onClick={calibrateAndStart}>校准并录音 <Mic2 size={18} /></button>} />}
        {phase === 'calibrating' && <StageOverlay icon={<Mic2 />} title="保持安静" detail="正在记住这里的环境底噪" progress={calibrationProgress} />}
        {phase === 'countdown' && <div className="countdown-overlay"><span>看好第一句</span><motion.strong key={countdown} initial={{ opacity: 0, scale: 1.35 }} animate={{ opacity: 1, scale: 1 }}>{countdown}</motion.strong></div>}
        {phase === 'error' && <StageOverlay icon={<Sparkles />} title="麦克风暂时不可用" detail={error || vadError || '可以先体验手动接唱模式'} action={<div className="overlay-actions"><button className="icon-command" title="返回配置" onClick={() => navigate(`/practice/${songId}`)}>←</button><button className="sing-primary-command" onClick={startWithoutMic}>无麦克风试玩 <Play size={18} /></button></div>} />}
      </AnimatePresence>
    </main>
  )
}

function ReferenceGuide({ at, track, trail, guidance }: { at: number; track: ReferenceTrack | null; trail: PitchTrailPoint[]; guidance: GuidanceResult }) {
  if (!track?.notes.length) return <div className="reference-guide empty"><span>原唱参考</span><small>参考旋律尚未准备好</small></div>
  const windowStart = Math.max(0, at - 1); const windowEnd = at + 4; const windowDuration = windowEnd - windowStart
  const notes = track.notes.filter((note) => note.endSec >= windowStart && note.startSec <= windowEnd)
  const tokens = track.tokens.filter((token) => token.endSec >= windowStart && token.startSec <= windowEnd && token.type !== 'punctuation')
  const pitches = [...notes.map((note) => note.midi), ...trail.map((point) => point.midi)]
  const low = Math.min(...pitches, 48) - 1; const high = Math.max(...pitches, 60) + 1; const span = Math.max(1, high - low)
  return <div className={`reference-guide guidance-${guidance.pitchState}`}>
    <header><span>原唱参考</span><b>{guidance.pitchLabel}</b><small>{guidance.centsError === null ? '' : `${guidance.centsError > 0 ? '+' : ''}${Math.round(guidance.centsError)} cents`}</small></header>
    <div className="melody-window"><i className="melody-cursor" />
      {notes.map((note) => <span className={note.id === guidance.targetNoteId ? 'reference-note active' : 'reference-note'} key={note.id} style={{ left: `${((note.startSec - windowStart) / windowDuration) * 100}%`, width: `${Math.max(2, ((note.endSec - note.startSec) / windowDuration) * 100)}%`, bottom: `${8 + ((note.midi - low) / span) * 78}%` }} />)}
      {trail.map((point) => <i className={`user-pitch-point ${point.state}`} key={`${point.at}-${point.midi}`} style={{ left: `${((point.at - windowStart) / windowDuration) * 100}%`, bottom: `${8 + ((point.midi - low) / span) * 78}%` }} />)}
    </div>
    <div className="melody-tokens">{tokens.map((token) => <span key={token.id} style={{ left: `${((token.startSec - windowStart) / windowDuration) * 100}%`, width: `${Math.max(3, ((token.endSec - token.startSec) / windowDuration) * 100)}%` }}>{token.text}</span>)}</div>
    <footer><span className={`timing-${guidance.timingState}`}>{guidance.timingLabel}</span>{track.mappingStatus !== 'reviewed' && <small>逐字映射为预览，审核后开放快慢判断</small>}</footer>
  </div>
}

function StageOverlay({ icon, title, detail, progress, action }: { icon: React.ReactNode; title: string; detail: string; progress?: number; action?: React.ReactNode }) {
  return (
    <motion.div className="stage-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <span className="overlay-icon">{icon}</span><h2>{title}</h2><p>{detail}</p>
      {typeof progress === 'number' && <div className="overlay-progress"><i style={{ width: `${progress * 100}%` }} /></div>}
      {action}
    </motion.div>
  )
}
