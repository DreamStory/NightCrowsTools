import { useEffect, useMemo, useState } from 'react';
import Tesseract from 'tesseract.js';

interface Region { left: number; top: number; width: number; height: number; }
interface WindowInfo { title: string; region: Region; }

function normalize(str: string) {
  return str
    .replace(/\s+/g, '')
    .replace(/[‧・．·･·]/g, '・')
    .replace(/[^\w\u4e00-\u9fff・]/g, '')
    .trim();
}
function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[a.length][b.length];
}
function fuzzyMatch(input: string, expectedList: string[], threshold = 0.7): string | null {
  let best: string | null = null, bestScore = 0;
  for (const t of expectedList) {
    const a = normalize(input), b = normalize(t);
    const maxLen = Math.max(a.length, b.length) || 1;
    const score = (maxLen - levenshtein(a, b)) / maxLen;
    if (score >= threshold && score > bestScore) { best = t; bestScore = score; }
  }
  return best;
}

export default function App() {
  const [wins, setWins] = useState<WindowInfo[]>([]);
  const [selected, setSelected] = useState<WindowInfo | null>(null);
  const [saveDir, setSaveDir] = useState<string | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>('');
  const [expectedInput, setExpectedInput] = useState<string>('');

  const expectedList = useMemo(
    () => expectedInput.split('\n').map(s => s.trim()).filter(Boolean),
    [expectedInput]
  );

  const fetchWins = async () => {
    const res = await window.electronAPI.listNightcrowsWindows();
    if (res.success && res.windows) setWins(res.windows);
    else alert(res.error ?? '找不到 NIGHT CROWS 視窗');
  };

  useEffect(() => { fetchWins(); }, []);

  const chooseFolder = async () => {
    const r = await window.electronAPI.chooseSaveFolder();
    if (r.success && r.path) setSaveDir(r.path); else alert(r.error ?? '尚未選擇資料夾');
  };

  const focusSelected = async () => {
    if (!selected) return alert('請先選擇視窗');
    const r = await window.electronAPI.bringWindowToFront(selected.region);
    if (!r.success) alert(r.error ?? '切換視窗失敗');
  };

  const captureSelected = async () => {
    if (!selected) return alert('請先選擇視窗');
    if (!saveDir) return alert('請先選擇儲存資料夾');
    const r = await window.electronAPI.screenshotWindow(selected.region, saveDir);
    if (r.success && r.dataUrl) setShot(r.dataUrl); else alert(r.error ?? '擷取失敗');
  };

  const runOCR = async () => {
    if (!shot) return alert('先擷取畫面');
    const res = await Tesseract.recognize(shot, 'chi_tra+eng', {
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    });
    setOcrText(res.data.text || '');
  };

  // 解析 OCR 文本為一行一個 ID
  const ocrList = useMemo(() =>
    ocrText.split('\n').map(s => s.trim()).filter(Boolean), [ocrText]
  );

  // 比對
  const normExpected = expectedList.map(normalize);
  const normActual = ocrList.map(normalize);

  const matched = expectedList.filter((id) =>
    normActual.includes(normalize(id)) || !!fuzzyMatch(id, ocrList));

  const notFound = expectedList.filter((id) =>
    !normActual.includes(normalize(id)) && !fuzzyMatch(id, ocrList));

  const unexpected = ocrList.filter((id) => {
    const n = normalize(id);
    if (normExpected.includes(n)) return false;
    return !fuzzyMatch(id, expectedList);
  });

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <h2>NIGHT CROWS 擷取 + OCR + 比對</h2>

      <div>
        <button onClick={fetchWins}>🔎 掃描 NIGHT CROWS 視窗</button>
      </div>

      <div>
        <strong>偵測到的視窗：</strong>
        <ul>
          {wins.map((w, i) => (
            <li key={`${w.title}-${w.region.left}-${w.region.top}-${i}`}>
              <button onClick={() => setSelected(w)}>
                {w.title} — {w.region.width}×{w.region.height} @ ({w.region.left},{w.region.top})
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <button onClick={focusSelected}>🪄 聚焦選中的視窗</button>
      </div>

      <div>
        <button onClick={chooseFolder}>📂 選擇儲存資料夾</button>
        <div>目前儲存位置：{saveDir ?? '（尚未設定）'}</div>
      </div>

      <div>
        <button onClick={captureSelected}>📸 擷取該視窗</button>
        {shot && <div style={{ marginTop: 8 }}><img src={shot} alt="shot" style={{ maxWidth: 600, border: '1px solid #ddd' }} /></div>}
      </div>

      <div>
        <textarea
          value={expectedInput}
          onChange={e => setExpectedInput(e.target.value)}
          rows={8}
          placeholder="在這裡貼你的名單，每行一個 ID"
          style={{ width: '100%' }}
        />
      </div>

      <div>
        <button onClick={runOCR}>🔠 OCR（繁中+英）</button>
        <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 8 }}>{ocrText}</pre>
      </div>

      <div>
        <h3>✔️ 有成功比對的 ID</h3>
        <ul>{matched.map((id, i) => <li key={i}>{id}</li>)}</ul>

        <h3>❌ 缺少的 ID（沒被擷取出來）</h3>
        <ul>{notFound.map((id, i) => <li key={i}>{id}</li>)}</ul>

        <h3>⚠️ 意外出現的 ID（未在清單內）</h3>
        <ul>{unexpected.map((id, i) => <li key={i}>{id}</li>)}</ul>
      </div>
    </div>
  );
}
