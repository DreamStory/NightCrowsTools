import { useRef, useState } from 'react';
import Tesseract from 'tesseract.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const cv: any;

function normalize(str: string) {
  return str
    .replace(/\s+/g, '')
    .replace(/[‧・．·･·]/g, '・')
    .replace(/[^\w\u4e00-\u9fff・]/g, '')
    .trim();
}

function fuzzyMatch(input: string, expectedList: string[]): string | null {
  const threshold = 0.7;
  let bestMatch = null;
  let maxSimilarity = 0;

  for (const target of expectedList) {
    const a = normalize(input);
    const b = normalize(target);
    const distance = levenshtein(a, b);
    const maxLen = Math.max(a.length, b.length);
    const similarity = (maxLen - distance) / maxLen;
    if (similarity > threshold && similarity > maxSimilarity) {
      bestMatch = target;
      maxSimilarity = similarity;
    }
  }
  return bestMatch;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[a.length][b.length];
}

export default function App() {
  const [idList, setIdList] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [expectedInput, setExpectedInput] = useState<string>('');
  const expectedList = expectedInput.split('\n').map(line => line.trim()).filter(Boolean);
  // const expectedList = [
  //   'Mermaidx', 'SilverSS', '順吉吉', 'T1・Zeus', 'T1・愛夜鴉愛娛美德',
  //   'T1・Faker', '黎明使者索拉卡', '姐姐也會仰式嗎', '天曈'
  // ];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setPreview(url);

    const img = new Image();
    img.src = url;
    img.onload = async () => {
      const src = cv.imread(img);
      const roi = src.roi(new cv.Rect(35, 0, 350, src.rows));
      const gray = new cv.Mat();
      cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);

      // cv.equalizeHist(gray, gray);
      cv.threshold(gray, gray, 100, 255, cv.THRESH_BINARY);

      if (canvasRef.current) cv.imshow(canvasRef.current, gray);

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = gray.cols;
      tempCanvas.height = gray.rows;
      cv.imshow(tempCanvas, gray);

      tempCanvas.toBlob(async (blob) => {
        if (!blob) return;
        const result = await Tesseract.recognize(blob, 'chi_tra+eng', {
          langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        });
        const rawText = result.data.text;
        const lines = rawText.split('\n').map(line => line.trim()).filter(Boolean);
        setIdList(lines);

        src.delete();
        roi.delete();
        gray.delete();
      });
    };
  };

  const normExpected = expectedList.map(normalize);
  const normActual = idList.map(normalize);

  const matched = expectedList.filter((id, idx) => normActual.includes(normExpected[idx]));
  const notFound = expectedList.filter((id, idx) => !normActual.includes(normExpected[idx]) && !idList.some(actual => fuzzyMatch(actual, [id])));
  const unexpected = idList.filter((id) => {
    const norm = normalize(id);
    return !normExpected.includes(norm) && !fuzzyMatch(id, expectedList);
  });

  return (
    <div>
      <h1>📋 擷取遊戲人員 ID（加入模糊比對）</h1>
      <textarea
        value={expectedInput}
        onChange={e => setExpectedInput(e.target.value)}
        rows={10}
        placeholder="請貼上 ID 清單，每行一個"
        style={{ width: '100%', marginBottom: '1rem' }}
      />
      <input type="file" accept="image/*" onChange={handleImageUpload} />
      {preview && <img src={preview} alt="preview" style={{ maxWidth: 400 }} />}

      <h2>處理後圖像：</h2>
      <canvas ref={canvasRef} style={{ border: '1px solid #ccc', maxWidth: 400 }} />

      <h2>✔️ 有成功比對的 ID</h2>
      <ul>{expectedList.filter(id => normActual.includes(normalize(id)) || idList.some(actual => fuzzyMatch(actual, [id]))).map((id, i) => <li key={i}>{id}</li>)}</ul>

      <h2>❌ 缺少的 ID（沒被擷取出來）</h2>
      <ul>{notFound.map((id, i) => <li key={i}>{id}</li>)}</ul>

      <h2>⚠️ 意外出現的 ID（未在清單內）</h2>
      <ul>{unexpected.map((id, i) => <li key={i}>{id}</li>)}</ul>
    </div>
  );
}