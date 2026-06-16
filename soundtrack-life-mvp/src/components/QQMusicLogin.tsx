import { useEffect, useState } from 'react'
import {
  checkQQMusicLogin,
  clearQQMusicSession,
  createQQMusicQRCode,
  getQQMusicSession,
  validateQQMusicSession,
} from '../lib/qqMusicLogin'

const EVENT_TEXT: Record<number, string> = {
  0: '登录成功',
  1: '等待扫码',
  2: '已扫码，等待确认',
  3: '二维码已过期',
  4: '已拒绝登录',
  [-1]: '登录异常',
}

export default function QQMusicLogin() {
  const [session, setSession] = useState<string | null>(() => getQQMusicSession())
  const [identifier, setIdentifier] = useState('')
  const [img, setImg] = useState('')
  const [status, setStatus] = useState(session ? 'QQ 音乐已登录，可尝试获取播放链接。' : '扫码后可尝试播放 QQ 音乐。')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!session) return
    validateQQMusicSession().then((ok) => {
      if (!ok) {
        setSession(null)
        setStatus('登录会话已失效，请重新扫码。')
      }
    })
  }, [session])

  async function startLogin() {
    setLoading(true)
    const qr = await createQQMusicQRCode('qq')
    setLoading(false)
    if (!qr?.data?.identifier || !qr.data.img) {
      setStatus('二维码获取失败，请稍后再试。')
      return
    }
    setIdentifier(qr.data.identifier)
    setImg(qr.data.img)
    setStatus('请使用 QQ 音乐 / QQ 扫码登录。')
  }

  function logout() {
    clearQQMusicSession()
    setSession(null)
    setIdentifier('')
    setImg('')
    setStatus('已清除本地登录会话。')
  }

  useEffect(() => {
    if (!identifier || session) return
    const timer = window.setInterval(async () => {
      const res = await checkQQMusicLogin(identifier, 'qq')
      const data = res?.data
      if (!data) return
      setStatus(EVENT_TEXT[data.event] ?? '等待登录状态更新')
      if (data.sessionId) {
        setSession(data.sessionId)
        setImg('')
        setIdentifier('')
        setStatus('QQ 音乐登录成功，可尝试获取播放链接。')
      }
      if (data.done && !data.sessionId) {
        setIdentifier('')
      }
    }, 1800)
    return () => window.clearInterval(timer)
  }, [identifier, session])

  return (
    <div className="qq-login">
      <div>
        <h4>QQ 音乐登录</h4>
        <p>{status}</p>
      </div>
      {img && <img src={img} alt="QQ 音乐登录二维码" />}
      <div className="qq-actions">
        {session ? (
          <button className="btn" onClick={logout}>退出登录</button>
        ) : (
          <button className="btn" onClick={startLogin} disabled={loading}>
            {loading ? '生成中…' : '扫码登录'}
          </button>
        )}
      </div>
    </div>
  )
}
