import { useEffect, useRef, useState } from 'react'
import { similarity, normalize } from './fuzzy.tsx'
import { ocrImageData } from './orc.tsx'
import './style.css'

interface SourceLite {
  id: string
  name: string
  thumbnailDataURL: string
}

export default function App() {
  const [sources, setSources] = useState<SourceLite[]>([])
  const [selected, setSelected] = useState<SourceLite | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  // 選取區域（以 video 的 CSS 尺寸為座標系）
  const [dragging, setDragging] = useState(false)
  const [rect, setRect] = useState<{ x: number, y: number, w: number, h: number }>({ x: 0, y: 0, w: 0, h: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [namesText, setNamesText] = useState('Alice\nBob\nCharlie')
  const [threshold, setThreshold] = useState(0.82)
  const [ocrText, setOcrText] = useState('')
  const [matches, setMatches] = useState<{ name: string; best: string; score: number }[]>([])

  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [stream])

  async function listNightCrows() {
    const raw = await desktopCapturer.getSources({ types: ['window'], fetchWindowIcons: true, thumbnailSize: { width: 320, height: 180 } })
    const filtered = raw.filter(s => /night\s*crows/i.test(s.name))
    const out: SourceLite[] = filtered.map(s => ({
      id: s.id,
      name: s.name,
      thumbnailDataURL: s.thumbnail.toDataURL()
    }))
    setSources(out)
  }

  async function startPreview(source: SourceLite) {
    // 關閉舊串流
    if (stream) stream.getTracks().forEach(t => t.stop())

    const newStream = await (navigator.mediaDevices as any).getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id
        }
      }
    })
    setSelected(source)
    setStream(newStream)
    if (videoRef.current) {
      videoRef.current.srcObject = newStream
      await videoRef.current.play()
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    if (!containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    setRect({ x, y, w: 0, h: 0 })
    setDragging(true)
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    setRect(prev => ({ ...prev, w: x - prev.x, h: y - prev.y }))
  }

  function onMouseUp() { setDragging(false) }

  async function captureAndOCR() {
    if (!videoRef.current) return
    const video = videoRef.current
    if (!video.videoWidth || !video.videoHeight) return

    // 以 video 內幕尺寸（實際像素）做裁切
    const scaleX = video.videoWidth / video.clientWidth
    const scaleY = video.videoHeight / video.clientHeight

    const sx = Math.max(0, Math.round((rect.w >= 0 ? rect.x : rect.x + rect.w) * scaleX))
    const sy = Math.max(0, Math.round((rect.h >= 0 ? rect.y : rect.y + rect.h) * scaleY))
    const sw = Math.abs(Math.round(rect.w * scaleX))
    const sh = Math.abs(Math.round(rect.h * scaleY))

    const canvas = document.createElement('canvas')
    canvas.width = sw
    canvas.height = sh
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh)

    const imgData = ctx.getImageData(0, 0, sw, sh)
    const text = (await ocrImageData(imgData)) || ''
    setOcrText(text)

    // 解析文字成候選名稱（僅英數與 - _ 空白 / 換行）
    const tokens = text
      .split(/\n|\r|\s/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.replace(/[^A-Za-z0-9\-_]/g, ''))
      .filter(Boolean)

    const want = namesText.split(/\n|\r/).map(s => s.trim()).filter(Boolean)

    const result: { name: string; best: string; score: number }[] = []
    for (const name of want) {
      let best = ''
      let bestScore = 0
      for (const t of tokens) {
        const sc = similarity(name, t)
        if (sc > bestScore) { bestScore = sc; best = t }
      }
      if (bestScore >= threshold) {
        result.push({ name, best, score: Number(bestScore.toFixed(3)) })
      }
    }
    setMatches(result)
  }

  async function testAutoClick() {
    // Demo：把滑鼠移到螢幕 (200, 200) 並點擊一次
    await window.automation.moveMouse(200, 200)
    await window.automation.click()
  }

  return (
    <div className="page">
      <h1>NIGHT CROWS 輔助工具 v0</h1>

      <section className="card">
        <div className="row gap">
          <button onClick={listNightCrows}>列出 NIGHT CROWS 視窗</button>
        </div>
        {sources.length > 0 && (
          <div className="grid">
            {sources.map(s => (
              <div key={s.id} className={`source ${selected?.id === s.id ? 'sel' : ''}`} onClick={() => startPreview(s)}>
                <img src={s.thumbnailDataURL} />
                <div className="caption">{s.name}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>視窗預覽與框選</h2>
        <div ref={containerRef} className="preview" onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}>
          <video ref={videoRef} muted playsInline></video>
          {(Math.abs(rect.w) > 3 && Math.abs(rect.h) > 3) && (
            <div className="select" style={{
              left: `${rect.w >= 0 ? rect.x : rect.x + rect.w}px`,
              top: `${rect.h >= 0 ? rect.y : rect.y + rect.h}px`,
              width: `${Math.abs(rect.w)}px`,
              height: `${Math.abs(rect.h)}px`
            }} />
          )}
        </div>
        <div className="row gap">
          <button onClick={captureAndOCR} disabled={!selected}>截圖 + 辨識</button>
          <button onClick={testAutoClick}>自動點擊測試</button>
        </div>
      </section>

      <section className="card cols">
        <div>
          <h3>名單（每行一個）</h3>
          <textarea value={namesText} onChange={e => setNamesText(e.target.value)} rows={10} />
          <div className="row">
            <label>相似度門檻：{threshold.toFixed(2)}</label>
            <input type="range" min={0.5} max={0.95} step={0.01} value={threshold} onChange={e => setThreshold(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <h3>OCR 結果</h3>
          <pre className="ocr">{ocrText || '（尚未辨識）'}</pre>
          <h3>比對命中</h3>
          {matches.length === 0 ? (
            <div>（尚無命中或未達門檻）</div>
          ) : (
            <table className="tbl">
              <thead><tr><th>名單</th><th>辨識到</th><th>相似度</th></tr></thead>
              <tbody>
                {matches.map((m, i) => (
                  <tr key={i}><td>{m.name}</td><td>{m.best}</td><td>{(m.score * 100).toFixed(1)}%</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}