import { useEffect, useRef, useState } from 'react'
import { mapCssRectToVideoPixels } from './utils/geo.tsx'
import { preprocessRGBA, findBlocks, type PreOptions } from './utils/image.tsx'
import { ocrImageData } from './utils/ocr.tsx'
import { applyConfusions, similarity } from './utils/fuzzy.tsx'
import './style.css'

type SourceLite = { id: string; name: string; thumbnailDataURL: string }

function must<T extends keyof Window['automation']>(k: T) {
  const api = (window as any).automation
  if (!api || typeof api[k] !== 'function') {
    alert('preload/automation 尚未就緒')
    throw new Error(`window.automation.${String(k)} not ready`)
  }
  return api[k] as any
}

export default function App() {
  // 來源清單
  const [keyword, setKeyword] = useState('night')
  const [sources, setSources] = useState<SourceLite[]>([])
  const [selectedId, setSelectedId] = useState<string>('')

  // 視訊
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 })

  // 框選
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [rect, setRect] = useState({ x: 0, y: 0, w: 0, h: 0 })

  // 前處理選項
  const [useCV, setUseCV] = useState(true)
  const [opt, setOpt] = useState<PreOptions>({
    scale: 1, blur: 0, adaptiveBlock: 31, C: 16,
    autoPolarity: true, invert: false, clahe: false, dilate: 1
  })
  const [showBoxes, setShowBoxes] = useState(true)
  const [psm, setPsm] = useState<6 | 7>(6)
  const [useChinese, setUseChinese] = useState(true)

  // Debug 視圖
  const [rawPreview, setRawPreview] = useState<string>('')     // 原始裁切
  const [procPreview, setProcPreview] = useState<string>('')   // 前處理後裁切
  const [boxes, setBoxes] = useState<{ x: number; y: number; w: number; h: number }[]>([])
  const [cropSize, setCropSize] = useState({ w: 0, h: 0 })

  // OCR & 比對
  const [ocrText, setOcrText] = useState('')
  const [listText, setListText] = useState('lEazy\nFrenzY69\nscrpTURKZ\nMiere016\njesssssssse\nDikkusBiggus\nAfterShockzi\nKinsayGahi')
  const [threshold, setThreshold] = useState(0.85)
  const [hits, setHits] = useState<{ list: string; matched: string; score: number }[]>([])

  useEffect(() => () => { stream?.getTracks().forEach(t => t.stop()) }, [stream])

  /** 來源清單（沿用你的 preload API） */
  async function listCaptureSources() {
    const listSources = must('listSources')
    const all: SourceLite[] = await listSources()
    const key = keyword.trim().toLowerCase()
    setSources(key ? all.filter(s => s.name.toLowerCase().includes(key)) : all)
  }

  /** 挑一個來源開始預覽 */
  async function startPreviewBySourceId(id: string) {
    try {
      const newStream = await (navigator.mediaDevices as any).getUserMedia({
        audio: false,
        video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: id } },
      })
      stream?.getTracks().forEach(t => t.stop())
      setStream(newStream)
      if (videoRef.current) {
        videoRef.current.srcObject = newStream
        await videoRef.current.play()
      }
      // 讀實際解析度
      const track = newStream.getVideoTracks()[0]
      const s = track.getSettings?.() || {}
      setVideoSize({ w: (s.width as number) || videoRef.current!.videoWidth, h: (s.height as number) || videoRef.current!.videoHeight })
      setSelectedId(id)
    } catch (e) {
      alert('擷取失敗，請重試或換一個來源')
      console.warn(e)
    }
  }

  // 框選互動
  function onMouseDown(e: React.MouseEvent) {
    if (!containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    setRect({ x: e.clientX - r.left, y: e.clientY - r.top, w: 0, h: 0 })
    setDragging(true)
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging || !containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    const x = e.clientX - r.left, y = e.clientY - r.top
    setRect(prev => ({ ...prev, w: x - prev.x, h: y - prev.y }))
  }
  function onMouseUp() { setDragging(false) }

  /** 產出 debug 預覽圖（PNG url） */
  function imageDataToPngURL(img: ImageData) {
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    const ctx = c.getContext('2d')!
    ctx.putImageData(img, 0, 0)
    return c.toDataURL('image/png')
  }

  /** 截圖 + 前處理 + 自動切塊 + OCR + 名單比對（並顯示預覽） */
  async function runOCR() {
    if (!videoRef.current) return
    const video = videoRef.current
    const { w: vW, h: vH } = videoSize
    if (!vW || !vH) { alert('請先選擇來源開始預覽'); return }

    const cont = containerRef.current!
    const containerW = cont.clientWidth, containerH = cont.clientHeight

    // 1) CSS → 影片像素（修正偏移/letterbox）
    const { sx, sy, sw, sh, drawBoxCss } = mapCssRectToVideoPixels({
      containerW, containerH, videoW: vW, videoH: vH, rectCss: rect
    })
    if (sw < 3 || sh < 3) { alert('框選太小'); return }

    // 2) 抓圖（直接以 video 原始解析度繪製）
    const canvas = document.createElement('canvas')
    canvas.width = vW; canvas.height = vH
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(video, 0, 0, vW, vH)

    const raw = ctx.getImageData(sx, sy, sw, sh)
    setRawPreview(imageDataToPngURL(raw))

    // 3) 前處理
    const processed = useCV && (window as any).cv ? preprocessRGBA(raw, opt) : raw
    setProcPreview(imageDataToPngURL(processed))
    setCropSize({ w: processed.width, h: processed.height })

    // 4) 自動切塊 + OCR
    let ocrAll = ''
    let rects: { x: number; y: number; w: number; h: number }[] = []
    if ((window as any).cv) {
      rects = findBlocks(processed, { minW: 16, minH: 12, minArea: 100 }).slice(0, 200)
      for (const r of rects) {
        const sub = new ImageData(r.w, r.h)
        // 從 processed 中切 ROI（注意 stride = processed.width）
        for (let y = 0; y < r.h; y++) {
          const srcOff = ((r.y + y) * processed.width + r.x) * 4
          const dstOff = (y * r.w) * 4
          sub.data.set(processed.data.slice(srcOff, srcOff + r.w * 4), dstOff)
        }
        const txt = await ocrImageData(sub, useChinese ? 'eng+chi_tra' : 'eng', psm)
        ocrAll += (txt.trim() + '\n')
      }
    } else {
      // 沒 OpenCV 就直接整塊 OCR
      ocrAll = await ocrImageData(processed, useChinese ? 'eng+chi_tra' : 'eng', psm)
    }
    setOcrText(ocrAll)
    setBoxes(showBoxes ? rects : [])

    // 5) 名單比對
    const tokens = ocrAll
      .split(/\s+|\n|\r/g)
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => applyConfusions(t).replace(/[^A-Za-z0-9\u4E00-\u9FFF\-_]/g, ''))
      .filter(Boolean)

    const wants = listText.split(/\n|\r/g).map(s => s.trim()).filter(Boolean)
    const res: { list: string; matched: string; score: number }[] = []
    for (const name of wants) {
      let best = '', bestScore = 0
      for (const t of tokens) {
        const sc = similarity(name, t)
        if (sc > bestScore) { bestScore = sc; best = t }
      }
      if (best && bestScore >= threshold) res.push({ list: name, matched: best, score: +bestScore.toFixed(3) })
    }
    res.sort((a, b) => b.score - a.score)
    setHits(res)
  }

  return (
    <div className="page">
      <h1>NIGHT CROWS 助手（來源→預覽→框選→前處理→OCR→名單比對）</h1>

      {/* 來源清單 */}
      <section className="card">
        <div className="row gap">
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="關鍵字（night）" />
          <button onClick={listCaptureSources}>列出來源</button>
          <span style={{ opacity: .7, fontSize: 12 }}>點卡片開始預覽</span>
        </div>
        {sources.length > 0 &&
          <div className="grid">
            {sources.map((s, i) => (
              <div key={s.id || `${s.name}-${i}`} className={`source ${selectedId === s.id ? 'sel' : ''}`} onClick={() => startPreviewBySourceId(s.id)} title={s.name}>
                {s.thumbnailDataURL ? <img src={s.thumbnailDataURL} /> : <div className="thumb-missing">no thumbnail</div>}
                <div className="caption">{s.name}</div>
              </div>
            ))}
          </div>
        }
      </section>

      {/* 預覽 + 框選 */}
      <section className="card">
        <h2>視窗預覽與框選</h2>
        <div
          ref={containerRef}
          className="preview"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          {(Math.abs(rect.w) > 3 && Math.abs(rect.h) > 3) && (
            <div className="select" style={{
              left: `${rect.w >= 0 ? rect.x : rect.x + rect.w}px`,
              top: `${rect.h >= 0 ? rect.y : rect.y + rect.h}px`,
              width: `${Math.abs(rect.w)}px`,
              height: `${Math.abs(rect.h)}px`,
            }} />
          )}
          {/* 切塊可視化（把 processed 的 block 轉回到容器座標：用 drawBoxCss + cropSize 做縮放） */}
          {showBoxes && cropSize.w > 0 && cropSize.h > 0 && boxes.map((b, i) => {
            const baseX = (rect.w >= 0 ? rect.x : rect.x + rect.w)
            const baseY = (rect.h >= 0 ? rect.y : rect.y + rect.h)
            const sx = Math.abs(rect.w) / cropSize.w
            const sy = Math.abs(rect.h) / cropSize.h
            return (
              <div key={i} style={{
                position: 'absolute',
                left: baseX + b.x * sx,
                top: baseY + b.y * sy,
                width: b.w * sx,
                height: b.h * sy,
                border: '1px solid rgba(96,165,250,.9)',
                boxShadow: '0 0 0 1px rgba(96,165,250,.5) inset',
                pointerEvents: 'none'
              }} />
            )
          })}
        </div>

        {/* 控制列 */}
        <div className="row gap" style={{ flexWrap: 'wrap' }}>
          <button onClick={runOCR} disabled={!selectedId}>截圖 + OCR + 名單比對</button>
          <label><input type="checkbox" checked={useCV} onChange={e => setUseCV(e.target.checked)} /> 使用OpenCV</label>
          <label><input type="checkbox" checked={opt.autoPolarity ?? true} onChange={e => setOpt({ ...opt, autoPolarity: e.target.checked })} /> 自動極性</label>
          <label><input type="checkbox" checked={opt.invert ?? false} onChange={e => setOpt({ ...opt, invert: e.target.checked })} /> 強制反轉</label>
          <label><input type="checkbox" checked={opt.clahe ?? false} onChange={e => setOpt({ ...opt, clahe: e.target.checked })} /> CLAHE</label>
          <label>膨脹:<input type="number" style={{ width: 48 }} value={opt.dilate ?? 1} onChange={e => setOpt({ ...opt, dilate: Math.max(0, Number(e.target.value) || 0) })} /></label>
          <label>scale:<input type="number" style={{ width: 56 }} step={0.5} min={1} max={3} value={opt.scale ?? 2} onChange={e => setOpt({ ...opt, scale: Number(e.target.value) })} /></label>
          <span>block:</span><input type="number" style={{ width: 56 }} value={opt.adaptiveBlock ?? 31} onChange={e => setOpt({ ...opt, adaptiveBlock: (Number(e.target.value) | 1) })} />
          <span>C:</span><input type="number" style={{ width: 56 }} value={opt.C ?? 8} onChange={e => setOpt({ ...opt, C: Number(e.target.value) })} />
          <span>blur:</span><input type="number" style={{ width: 56 }} value={opt.blur ?? 3} onChange={e => setOpt({ ...opt, blur: Number(e.target.value) })} />
          <label><input type="checkbox" checked={showBoxes} onChange={e => setShowBoxes(e.target.checked)} /> 顯示切塊框</label>
          <label><input type="checkbox" checked={useChinese} onChange={e => setUseChinese(e.target.checked)} /> 中文 (eng+chi_tra)</label>
          <label>PSM:
            <select value={psm} onChange={e => setPsm(Number(e.target.value) as any)}>
              <option value={6}>6（單區塊）</option>
              <option value={7}>7（單行）</option>
            </select>
          </label>
        </div>
      </section>

      {/* Debug 預覽 */}
      <section className="card">
        <h2>前處理預覽（Debug）</h2>
        <div className="debug-panes">
          <div>
            <div className="debug-title">原始框選</div>
            {rawPreview ? <img src={rawPreview} /> : <div className="ph">尚無</div>}
            {rawPreview && <a href={rawPreview} download="raw.png">下載 PNG</a>}
          </div>
          <div>
            <div className="debug-title">OpenCV 前處理後</div>
            {procPreview ? <img src={procPreview} /> : <div className="ph">尚無</div>}
            {procPreview && <a href={procPreview} download="proc.png">下載 PNG</a>}
          </div>
        </div>
        <div style={{ opacity: .7, fontSize: 12, marginTop: 6 }}>
          字太細可試：scale=2~3、膨脹=1~2、C=6~12。若白字黯淡，開 CLAHE；或把「自動極性」打開/關閉比較。
        </div>
      </section>

      {/* 名單比對 */}
      <section className="card cols">
        <div>
          <h3>名單（每行一個）</h3>
          <textarea value={listText} onChange={e => setListText(e.target.value)} rows={12} />
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <label>相似度門檻：{threshold.toFixed(2)}</label>
            <input type="range" min={0.5} max={0.98} step={0.01} value={threshold} onChange={e => setThreshold(Number(e.target.value))} style={{ width: 240 }} />
          </div>
          <div style={{ fontSize: 12, opacity: .75, marginTop: 6 }}>會自動套用常見誤辨替換（0↔O、1↔l↔I、全形→半形…）。</div>
        </div>
        <div>
          <h3>OCR 文字</h3>
          <pre className="ocr">{ocrText || '（尚未辨識）'}</pre>
          <h3>比對命中</h3>
          {hits.length === 0 ? <div>（尚無命中或未達門檻）</div> : (
            <table className="tbl">
              <thead><tr><th>名單</th><th>辨識到</th><th>相似度</th></tr></thead>
              <tbody>{hits.map((m, i) => (
                <tr key={`${m.list}-${m.matched}-${i}`}><td>{m.list}</td><td>{m.matched}</td><td>{(m.score * 100).toFixed(1)}%</td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
