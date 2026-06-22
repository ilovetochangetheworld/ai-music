import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Hand, Headphones, RotateCcw, ShieldCheck } from 'lucide-react'
import XiaoMai from '../components/XiaoMai'
import { markLatencyCalibrationSkipped, saveLatencyCalibration } from '../features/practice-room/latencyCalibration'
import { runTapLatencyCalibration, type TapCalibrationProgress } from '../features/practice-room/tapLatencyRunner'
import type { DeviceLatencyCalibration } from '../../shared/contracts'

type Phase = 'intro' | 'running' | 'result' | 'error'
const INITIAL_PROGRESS: TapCalibrationProgress = { beat: 0, total: 6, detected: 0, phase: 'noise' }

export default function LatencyCalibrationPage() {
  const { songId = 'trajectory' } = useParams()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [phase, setPhase] = useState<Phase>('intro')
  const [progress, setProgress] = useState(INITIAL_PROGRESS)
  const [result, setResult] = useState<DeviceLatencyCalibration | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const destination = params.get('next') === 'sing' ? `/practice/${songId}/sing` : `/practice/${songId}`

  useEffect(() => () => abortRef.current?.abort(), [])

  async function start() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setProgress(INITIAL_PROGRESS)
    setError('')
    setPhase('running')
    try {
      const calibration = await runTapLatencyCalibration(setProgress, controller.signal)
      saveLatencyCalibration(calibration)
      setResult(calibration)
      setPhase('result')
    } catch (reason) {
      if (controller.signal.aborted) return
      setError(reason instanceof Error && reason.name === 'NotAllowedError' ? '没有获得麦克风权限。可以在浏览器设置中允许后重试，也可以暂时跳过。' : reason instanceof Error ? reason.message : '这次没有完成校准')
      setPhase('error')
    }
  }

  function skip() {
    markLatencyCalibrationSkipped()
    navigate(destination)
  }

  return <main className="practice-mobile warm-room-page latency-page">
    <header className="warm-page-header"><button onClick={() => navigate(`/practice/${songId}`)}><ArrowLeft /></button><h1>延迟校准</h1><span /></header>
    <section className="latency-hero">
      <div className="companion-speech">{phase === 'running' ? '听到节拍就拍一下手' : phase === 'result' ? '节奏时间轴对齐啦' : '先对齐设备，再放心开唱'}</div>
      <XiaoMai state={phase === 'running' ? 'listening' : phase === 'result' ? 'cheering' : 'ready'} />
    </section>

    {phase === 'intro' && <section className="latency-sheet">
      <Headphones className="latency-main-icon" />
      <h2>首次使用校准一次</h2>
      <p>不同手机和耳机可能产生延迟。戴好平时练歌使用的耳机，安静一秒，然后跟着 6 个节拍拍手。</p>
      <div className="latency-note"><ShieldCheck /><span>只分析拍手时刻，不录音、不上传；结果在当前浏览器保存 30 天。</span></div>
      <button className="practice-primary" onClick={() => void start()}><Hand />开始跟拍校准</button>
      <button className="latency-skip" onClick={skip}>暂时跳过</button>
    </section>}

    {phase === 'running' && <section className="latency-sheet latency-running">
      <small>{progress.phase === 'noise' ? '正在听环境底噪' : progress.phase === 'count_in' ? '前两拍先听，不用拍手' : '跟着节拍拍手'}</small>
      <div className="latency-beats">{Array.from({ length: 6 }, (_, index) => <i key={index} className={index < progress.beat ? 'active' : ''} />)}</div>
      <strong>{progress.phase === 'tapping' ? `${progress.beat} / 6` : '准备'}</strong>
      <p>已识别 {progress.detected} 次拍手</p>
    </section>}

    {phase === 'result' && result && <section className="latency-sheet latency-result">
      <CheckCircle2 className={result.status === 'valid' ? 'valid' : 'muted'} />
      <h2>{result.status === 'valid' ? '校准完成' : '本次样本不够稳定'}</h2>
      <div className="latency-result-grid"><span><b>{result.offsetMs}ms</b><small>综合偏移</small></span><span><b>±{result.jitterMs}ms</b><small>跟拍波动</small></span><span><b>{result.sampleCount}/6</b><small>有效样本</small></span></div>
      <p>{result.status === 'valid' ? '小麦会在实时参考和唱后节奏分析中自动补偿。' : '这次结果已保留，但不会用于强行修正节奏；建议换安静环境再测。'}</p>
      <button className="practice-primary" onClick={() => navigate(destination)}>继续开唱</button>
      <button className="latency-skip" onClick={() => void start()}><RotateCcw />重新校准</button>
    </section>}

    {phase === 'error' && <section className="latency-sheet latency-result">
      <h2>还没校准成功</h2><p>{error}</p>
      <button className="practice-primary" onClick={() => void start()}><RotateCcw />重新尝试</button>
      <button className="latency-skip" onClick={skip}>暂时跳过并开唱</button>
    </section>}
  </main>
}
